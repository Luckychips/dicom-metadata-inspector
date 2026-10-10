import { createBinaryContext, readBytes, parseElementHeader } from '@/cores';
import { PIXEL_DATA_TAG } from '@/cores';
import type {
    ParseDatasetOptions,
    ParsedDataElement,
    ParsedDataset,
    TransferSyntax,
} from '@/cores';

const isPixelData = (group: number, element: number) => {
    return group === PIXEL_DATA_TAG.group && element === PIXEL_DATA_TAG.element;
}

export const parseDataset = (
    buffer: ArrayBuffer,
    startOffset: number,
    transferSyntax: TransferSyntax,
    options: ParseDatasetOptions = {}
): ParsedDataset => {
    const { includePixelData = false, maxElements = 100_000 } = options;

    const context = createBinaryContext(
        buffer,
        transferSyntax.littleEndian ? 'LE' : 'BE'
    );

    const elements: ParsedDataElement[] = [];
    let offset = startOffset;
    let count = 0;

    while (offset < context.view.byteLength) {
        if (count >= maxElements) {
            return {
                elements,
                startOffset,
                endOffset: offset,
                stoppedEarly: true,
                stopReason: `Maximum element count (${maxElements}) exceeded`,
            };
        }

        /**
         * 최소 Tag(4 bytes)가 남아있어야 함.
         */
        if (offset + 4 > context.view.byteLength) {
            return {
                elements,
                startOffset,
                endOffset: offset,
                stoppedEarly: true,
                stopReason: 'Incomplete Data Element tag',
            };
        }

        let header;
        try {
            header = parseElementHeader(
                context,
                offset,
                { explicitVR: transferSyntax.explicitVR }
            );
        } catch (error) {
            return {
                elements,
                startOffset,
                endOffset: offset,
                stoppedEarly: true,
                stopReason: error instanceof Error ? error.message : 'Failed to parse Data Element header',
            };
        }

        /**
         * Undefined Length는 SQ / Item /
         * encapsulated Pixel Data 처리가 필요.
         *
         * FR-06 전에는 안전하게 여기서 종료.
         */
        if (header.undefinedLength) {
            elements.push({
                ...header,
                rawValue: null,
            });

            return {
                elements,
                startOffset,
                endOffset:
                header.valueOffset,
                stoppedEarly: true,
                stopReason: `Undefined Length encountered at ` + formatTag(header.tag.group, header.tag.element),
            };
        }

        const valueEnd = header.valueOffset + header.valueLength;
        if (valueEnd > context.view.byteLength) {
            return {
                elements,
                startOffset,
                endOffset: offset,
                stoppedEarly: true,
                stopReason: `Value exceeds buffer at ${formatTag(header.tag.group, header.tag.element)}`,
            };
        }

        const pixelData = isPixelData(header.tag.group, header.tag.element);

        /**
         * Pixel Data는 기본적으로 메모리에
         * 복사/보관하지 않음.
         *
         * readBytes 자체는 zero-copy view지만
         * ParsedDataset이 대형 Pixel Data를 계속
         * 참조하지 않도록 null 처리.
         */
        const rawValue =
            pixelData && !includePixelData ? null : readBytes(context, header.valueOffset, header.valueLength).value;

        elements.push({
            ...header,
            rawValue,
        });

        offset = valueEnd;
        count += 1;
    }

    return {
        elements,
        startOffset,
        endOffset: offset,
        stoppedEarly: false,
    };
};

const formatTag = (group: number, element: number
): string => {
    const hex = (value: number): string => {
        return value.toString(16).toUpperCase().padStart(4, '0');
    }

    return `(${hex(group)},${hex(element)})`;
};
