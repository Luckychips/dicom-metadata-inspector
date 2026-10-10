import {
    createBinaryContext,
    parseElementHeader,
    readBytes,
} from '@/cores';
import {
    ITEM_GROUP,
    ITEM_ELEMENT,
    ITEM_DELIMITATION_ELEMENT,
    SEQUENCE_DELIMITATION_ELEMENT,
    PIXEL_DATA_GROUP,
    PIXEL_DATA_ELEMENT,
    UNDEFINED_LENGTH,
} from '@/cores';
import type {
    BinaryContext,
    DicomElementHeader,
    DicomSequenceItem,
    ParsedDataElement,
    ParsedDataset,
    ParseDatasetOptions,
    TransferSyntax,
} from '@/cores';

/**
 * 내부 파싱 상태
 */
interface ParseState {
    context: BinaryContext;
    transferSyntax: TransferSyntax;
    includePixelData: boolean;
    maxElements: number;
    maxDepth: number;

    /**
     * 중첩 Dataset 전체 Element 개수
     */
    elementCount: number;
}

/**
 * Dataset 종료 조건
 */
type DatasetTermination = | 'end' | 'item-delimitation';

/**
 * 내부 Dataset 파싱 결과
 */
interface DatasetParseResult {
    dataset: ParsedDataset;
    nextOffset: number;
    termination: DatasetTermination;
}

/**
 * Sequence 파싱 결과
 */
interface SequenceParseResult {
    items: DicomSequenceItem[];
    nextOffset: number;
}

/**
 * Fragment Skip 결과
 */
interface FragmentSkipResult {
    nextOffset: number;
}

/**
 * 기본 설정
 */
const DEFAULT_MAX_ELEMENTS = 100000;
const DEFAULT_MAX_DEPTH = 32;

/**
 * Tag 비교
 */
const isTag = (
    group: number,
    element: number,
    expectedGroup: number,
    expectedElement: number
): boolean => {
    return (group === expectedGroup && element === expectedElement);
};

/**
 * Pixel Data 여부
 */
const isPixelData = (group: number, element: number): boolean => {
    return isTag(group, element, PIXEL_DATA_GROUP, PIXEL_DATA_ELEMENT);
};

/**
 * Buffer 범위 검사
 */
const assertRange = (offset: number, length: number, endOffset: number): void => {
    const isInvalid = !Number.isSafeInteger(offset)
        || !Number.isSafeInteger(length)
        || offset < 0
        || length < 0
        || offset > endOffset
        || length > endOffset - offset;

    if (isInvalid) {
        throw new RangeError(`Invalid DICOM range: offset=${offset}, length=${length}, end=${endOffset}`);
    }
};

/**
 * 중첩 깊이 검사
 */
const assertDepth = (depth: number, state: ParseState): void => {
    if (depth > state.maxDepth) {
        throw new Error(`Maximum DICOM sequence depth exceeded: ${state.maxDepth}`);
    }
};

/**
 * Element 개수 제한
 */
const incrementElementCount = (state: ParseState): void => {
    state.elementCount += 1;

    if (state.elementCount > state.maxElements) {
        throw new Error(`Maximum DICOM element count exceeded: ${state.maxElements}`);
    }
};

/**
 * Tag Group / Element 읽기
 *
 * Item / Delimitation은
 * 일반 Explicit VR Header로 읽으면 안 된다.
 */
const readTag = (state: ParseState, offset: number, endOffset: number): {
    group: number;
    element: number;
} => {
    assertRange(offset, 4, endOffset);

    const view = state.context.view;
    const littleEndian = state.transferSyntax.littleEndian;

    return {
        group: view.getUint16(offset, littleEndian),
        element: view.getUint16(offset + 2, littleEndian),
    };
};

/**
 * Item Header 읽기
 *
 * (FFFE,E000)
 * VL: 4 bytes
 *
 * 총 8 bytes
 */
const readItemHeader = (state: ParseState, offset: number, endOffset: number): {
    group: number;
    element: number;
    valueLength: number;
    undefinedLength: boolean;
    valueOffset: number;
} => {
    assertRange(offset, 8, endOffset);

    const tag = readTag(state, offset, endOffset);
    const valueLength = state.context.view.getUint32(offset + 4, state.transferSyntax.littleEndian);

    return {
        ...tag,
        valueLength,
        undefinedLength: valueLength === UNDEFINED_LENGTH,
        valueOffset: offset + 8,
    };
};

/**
 * Delimitation Item 검증
 *
 * Item Delimitation 및
 * Sequence Delimitation의 VL은 0이어야 한다.
 */
const assertDelimitationLength = (valueLength: number, offset: number): void => {
    if (valueLength !== 0) {
        throw new Error(`Invalid delimitation length at offset ${offset}: ${valueLength}`);
    }
};

/**
 * 일반 Element의 Value 끝 위치
 */
const getValueEnd = (header: DicomElementHeader, endOffset: number): number => {
    if (header.undefinedLength) {
        throw new Error(`Undefined length cannot be resolved directly at offset ${header.offset}`);
    }

    assertRange(header.valueOffset, header.valueLength, endOffset);

    return (header.valueOffset + header.valueLength);
};

/**
 * Encapsulated Pixel Data Fragment 건너뛰기
 *
 * Pixel Data Fragment는 SQ Item과
 * Header 형식이 유사하지만,
 * 내부 Value는 Dataset이 아니다.
 *
 * 따라서 재귀 Dataset 파싱을 수행하지 않는다.
 *
 * Basic Offset Table 및 Fragment들을
 * 건너뛰고 Sequence Delimitation을 찾는다.
 */
const skipEncapsulatedFragments = (state: ParseState, startOffset: number, endOffset: number): FragmentSkipResult => {
    let offset = startOffset;

    while (offset < endOffset) {
        const header = readItemHeader(state, offset, endOffset);

        /**
         * Sequence Delimitation
         */
        if (isTag(header.group, header.element, ITEM_GROUP, SEQUENCE_DELIMITATION_ELEMENT)) {
            assertDelimitationLength(header.valueLength, offset);

            return { nextOffset: header.valueOffset };
        }

        /**
         * Fragment Item이 아니면 오류
         */
        if (!isTag(header.group, header.element, ITEM_GROUP, ITEM_ELEMENT)) {
            throw new Error(`Invalid encapsulated fragment tag at offset ${offset}`);
        }

        /**
         * Fragment는 Defined Length만 허용
         */
        if (header.undefinedLength) {
            throw new Error(`Undefined fragment length at offset ${offset}`);
        }

        assertRange(header.valueOffset, header.valueLength, endOffset);

        offset = header.valueOffset + header.valueLength;
    }

    throw new Error(`Missing Sequence Delimitation for encapsulated Pixel Data at offset ${startOffset}`);
};

/**
 * Sequence Item 파싱
 */
const parseSequenceItem = (state: ParseState, offset: number, endOffset: number, depth: number): {
    item: DicomSequenceItem;
    nextOffset: number;
} => {
    assertDepth(depth, state);

    const header = readItemHeader(state, offset, endOffset);

    if (!isTag(header.group, header.element, ITEM_GROUP, ITEM_ELEMENT)) {
        throw new Error(`Expected Sequence Item at offset ${offset}`);
    }

    /**
     * Defined Length Item
     */
    if (!header.undefinedLength) {
        assertRange(header.valueOffset, header.valueLength, endOffset);

        const itemEnd = header.valueOffset + header.valueLength;
        const result = parseDatasetRegion(state, header.valueOffset, itemEnd, depth, false);

        if (result.termination !== 'end' || result.nextOffset !== itemEnd) {
            throw new Error(`Invalid defined-length Item at offset ${offset}`);
        }

        const item: DicomSequenceItem = {
            offset,
            valueOffset: header.valueOffset,
            valueLength: header.valueLength,
            undefinedLength: false,
            dataset: result.dataset,
            endOffset: itemEnd,
        };

        return {
            item,
            nextOffset: itemEnd,
        };
    }

    /**
     * Undefined Length Item
     *
     * Item Delimitation까지 파싱
     */
    const result = parseDatasetRegion(state, header.valueOffset, endOffset, depth, true);
    if (result.termination !== 'item-delimitation') {
        throw new Error(`Missing Item Delimitation at offset ${offset}`);
    }

    const item: DicomSequenceItem = {
        offset,
        valueOffset: header.valueOffset,
        valueLength: header.valueLength,
        undefinedLength: true,
        dataset: result.dataset,
        endOffset: result.nextOffset,
    };

    return {
        item,
        nextOffset: result.nextOffset,
    };
};

/**
 * Sequence 파싱
 *
 * Defined Length / Undefined Length 모두 지원
 */
const parseSequence = (state: ParseState, header: DicomElementHeader, endOffset: number, depth: number): SequenceParseResult => {
    assertDepth(depth, state);

    const items: DicomSequenceItem[] = [];

    let offset = header.valueOffset;

    /**
     * Defined Length SQ
     */
    if (!header.undefinedLength) {
        const sequenceEnd = getValueEnd(header, endOffset);
        while (offset < sequenceEnd) {
            const result = parseSequenceItem(state, offset, sequenceEnd, depth);

            items.push(result.item);

            offset = result.nextOffset;
        }

        if (offset !== sequenceEnd) {
            throw new Error(`Invalid Sequence length at offset ${header.offset}`);
        }

        return {
            items,
            nextOffset: sequenceEnd,
        };
    }

    /**
     * Undefined Length SQ
     */
    while (offset < endOffset) {
        const tag = readTag(state, offset, endOffset);

        /**
         * Sequence Delimitation
         */
        if (isTag(tag.group, tag.element, ITEM_GROUP, SEQUENCE_DELIMITATION_ELEMENT)) {
            const delimiter = readItemHeader(state, offset, endOffset);
            assertDelimitationLength(delimiter.valueLength, offset);

            return {
                items,
                nextOffset: delimiter.valueOffset,
            };
        }

        const result = parseSequenceItem(state, offset, endOffset, depth);

        items.push(result.item);

        offset = result.nextOffset;
    }

    throw new Error(`Missing Sequence Delimitation at offset ${header.offset}`);
};

/**
 * Dataset 내부 파싱
 *
 * 최상위 Dataset 및 Sequence Item 내부 Dataset에서
 * 공통으로 사용한다.
 */
const parseDatasetRegion = (
    state: ParseState,
    startOffset: number,
    endOffset: number,
    depth: number,
    allowItemDelimitation: boolean
): DatasetParseResult => {
    assertDepth(depth, state);

    const elements: ParsedDataElement[] = [];

    let offset = startOffset;

    while (offset < endOffset) {
        /**
         * 최소 Tag 크기 확인
         */
        assertRange(offset, 4, endOffset);

        const tag = readTag(state, offset, endOffset);

        /**
         * Item Delimitation
         */
        if (isTag(tag.group, tag.element, ITEM_GROUP, ITEM_DELIMITATION_ELEMENT)) {
            if (!allowItemDelimitation) {
                throw new Error(`Unexpected Item Delimitation at offset ${offset}`);
            }

            const delimiter = readItemHeader(state, offset, endOffset);
            assertDelimitationLength(delimiter.valueLength, offset);

            return {
                dataset: {
                    elements,
                    startOffset,
                    endOffset: offset,
                    stoppedEarly: false,
                },
                nextOffset: delimiter.valueOffset,
                termination: 'item-delimitation',
            };
        }

        /**
         * Sequence Delimitation은
         * parseSequence()에서만 처리한다.
         */
        if (tag.group === ITEM_GROUP) {
            throw new Error(`Unexpected Item/Delimitation tag at offset ${offset}`);
        }

        incrementElementCount(state);

        /**
         * 일반 Data Element Header
         */
        const header = parseElementHeader(state.context, offset, {
            explicitVR:
            state.transferSyntax.explicitVR,
        });

        /**
         * Header가 현재 Dataset 영역을
         * 넘어가지 않았는지 확인
         */
        assertRange(offset, header.valueOffset - offset, endOffset);

        /**
         * Pixel Data
         */
        const pixelData = isPixelData(header.tag.group, header.tag.element);

        /**
         * SQ
         */
        if (header.vr === 'SQ') {
            const sequence = parseSequence(state, header, endOffset, depth + 1);
            elements.push({
                ...header,
                rawValue: null,
                items: sequence.items,
                endOffset: sequence.nextOffset,
            });

            offset = sequence.nextOffset;
            continue;
        }

        /**
         * Undefined Length Pixel Data
         *
         * Encapsulated Transfer Syntax
         */
        if (pixelData && header.undefinedLength && state.transferSyntax.encapsulated) {
            const fragments = skipEncapsulatedFragments(state, header.valueOffset, endOffset);
            elements.push({
                ...header,
                rawValue: null,
                endOffset: fragments.nextOffset,
            });

            offset = fragments.nextOffset;
            continue;
        }

        /**
         * 기타 Undefined Length
         *
         * Implicit VR SQ 등은 FR-07 Dictionary
         * 적용 전까지 확정할 수 없다.
         */
        if (header.undefinedLength) {
            throw new Error(`Unsupported undefined-length element at offset ${offset}`);
        }

        /**
         * 일반 Value
         */
        const valueEnd = getValueEnd(header, endOffset);
        const rawValue = pixelData &&
            !state.includePixelData ? null : readBytes(
                state.context,
                header.valueOffset,
                header.valueLength
            ).value;

        elements.push({
            ...header,
            rawValue,
            endOffset: valueEnd,
        });

        offset = valueEnd;
    }

    return {
        dataset: {
            elements,
            startOffset,
            endOffset: offset,
            stoppedEarly: false,
        },
        nextOffset: offset,
        termination: 'end',
    };
};

/**
 * Public API
 *
 * FR-03 기존 함수 시그니처 유지
 */
export const parseDataset = (
    buffer: ArrayBuffer,
    startOffset: number,
    transferSyntax: TransferSyntax,
    options: ParseDatasetOptions = {}
): ParsedDataset => {
    const context = createBinaryContext(buffer, transferSyntax.littleEndian ? 'LE' : 'BE');

    const state: ParseState = {
        context,
        transferSyntax,
        includePixelData: options.includePixelData ?? false,
        maxElements: options.maxElements ?? DEFAULT_MAX_ELEMENTS,
        maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
        elementCount: 0,
    };

    const result = parseDatasetRegion(state, startOffset, context.view.byteLength, 0, false);
    return result.dataset;
};
