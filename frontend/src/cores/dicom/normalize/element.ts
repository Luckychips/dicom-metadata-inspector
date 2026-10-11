import { createTagKey, decodeDataElement, getDictionaryEntryByTag, isPrivateTag } from '@/cores';
import type { DicomDecodedValue, ParsedDataElement, TransferSyntax } from '@/cores';
import { formatDicomTag } from './utils';
import type { NormalizedDicomElement } from './types';

/**
 * Normalizer 실행 옵션
 */
export interface NormalizeElementOptions {
    /**
     * TextDecoder에 전달할 인코딩.
     *
     * null이면 비 ASCII 텍스트를
     * 추측해서 디코딩하지 않는다.
     */
    encoding?: string | null;
}

/**
 * Binary VR 여부
 */
const BINARY_VRS = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'UN']);

/**
 * DICOM Character Set 영향을 받는
 * 텍스트 VR.
 *
 * ASCII 기반 VR(UI, CS, DA 등)은 제외한다.
 */
const CHARACTER_SET_VRS = new Set(['LO', 'LT', 'PN', 'SH', 'ST', 'UC', 'UT']);

/**
 * 원본 bytes가 ASCII 범위인지 확인
 */
const isAscii = (bytes: Uint8Array): boolean => {
    return bytes.every(byte => byte <= 0x7f);
};

/**
 * Element의 Value를 안전하게 디코딩
 */
const decodeNormalizedValue = (
    element: ParsedDataElement,
    transferSyntax: TransferSyntax,
    options: NormalizeElementOptions
): {
    value: DicomDecodedValue;
    isDecoded: boolean;
} => {
    if (element.rawValue === null) {
        return {
            value: null,
            isDecoded: false,
        };
    }

    /**
     * Unknown VR
     *
     * FR-07에서 해결되지 않은 경우
     * 원본 bytes 유지
     */
    if (element.vr === null) {
        return {
            value: element.rawValue,
            isDecoded: false,
        };
    }

    /**
     * Character Set 미지원 시
     * 비 ASCII 문자열을 잘못 해석하지 않는다.
     */
    if (CHARACTER_SET_VRS.has(element.vr) && options.encoding === null && !isAscii(element.rawValue)) {
        return {
            value: element.rawValue,
            isDecoded: false,
        };
    }

    /**
     * Binary VR
     */
    if (BINARY_VRS.has(element.vr)) {
        return {
            value: element.rawValue,
            isDecoded: false,
        };
    }

    const value = decodeDataElement(element, transferSyntax, {
        encoding: options.encoding ?? 'utf-8',
    });

    /**
     * 잘못된 Binary VL 등으로 decoder가
     * null을 반환한 경우도 구분한다.
     */
    return {
        value,
        isDecoded: value !== null || element.rawValue.byteLength === 0,
    };
};

/**
 * SQ Item 정규화
 *
 * 순환 import를 피하기 위해
 * Dataset 정규화 함수를 인자로 전달한다.
 */
export type NormalizeNestedDataset = (elements: ParsedDataElement[]) => NormalizedDicomElement[];

/**
 * 개별 Element 정규화
 */
export const normalizeDataElement = (
    element: ParsedDataElement,
    transferSyntax: TransferSyntax,
    normalizeNestedDataset: NormalizeNestedDataset,
    options: NormalizeElementOptions = {}
): NormalizedDicomElement => {
    const dictionaryEntry = getDictionaryEntryByTag(element.tag);
    const tag = createTagKey(element.tag.group, element.tag.element);
    const formattedTag = formatDicomTag(element.tag.group, element.tag.element);
    const privateTag = isPrivateTag(element.tag.group);
    const initialized: NormalizedDicomElement = {
        tag,
        formattedTag,
        group: element.tag.group,
        element: element.tag.element,
        name: dictionaryEntry?.name ?? null,
        keyword: dictionaryEntry?.keyword ?? null,
        vr: element.vr,
        dictionaryVR: dictionaryEntry?.vr ?? [],
        vm: dictionaryEntry?.vm ?? null,
        value: null,
        items: null,
        valueLength: element.valueLength,
        undefinedLength: element.undefinedLength,
        isPrivate: privateTag,
        isKnown: dictionaryEntry !== null,
        isBinary: false,
        isDecoded: true,
        isValueOmitted: false,
    };

    if (element.vr === 'SQ') {
        initialized.items = (element.items ?? []).map(
            (item, index) => ({
                index,
                elements: normalizeNestedDataset(item.dataset.elements),
            }));

        return initialized;
    }

    const decoded = decodeNormalizedValue(element, transferSyntax, options);
    const binaryValue = decoded.value instanceof Uint8Array;

    initialized.value = decoded.value;
    initialized.isBinary = binaryValue;
    initialized.isDecoded = decoded.isDecoded;
    initialized.isValueOmitted = element.rawValue === null && element.valueLength !== 0;

    return initialized;
};
