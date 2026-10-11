import type {
    ParsedDataset,
    ParsedDataElement,
    TransferSyntax,
} from '@/cores';
import {
    normalizeDataElement,
    type NormalizeElementOptions,
} from './element';
import type {
    NormalizedDicomDataset,
    NormalizedDicomElement,
} from './types';

/**
 * 중첩 Element 개수 계산
 */
export const countNormalizedElements = (elements: readonly NormalizedDicomElement[]): number => {
    let count = 0;
    for (const element of elements) {
        count += 1;

        if (element.items) {
            for (const item of element.items) {
                count += countNormalizedElements(item.elements);
            }
        }
    }

    return count;
};

/**
 * Dataset Element 목록 정규화
 */
export const normalizeDatasetElements = (
    elements: readonly ParsedDataElement[],
    transferSyntax: TransferSyntax,
    options: NormalizeElementOptions = {}
): NormalizedDicomElement[] => {
    const normalizeNested = (nestedElements: ParsedDataElement[]): NormalizedDicomElement[] => {
        return normalizeDatasetElements(nestedElements, transferSyntax, options);
    };

    return elements.map(element => normalizeDataElement(element, transferSyntax, normalizeNested, options));
};

/**
 * ParsedDataset → NormalizedDicomDataset
 */
export const normalizeDataset = (
    dataset: ParsedDataset,
    transferSyntax: TransferSyntax,
    options: NormalizeElementOptions = {}
): NormalizedDicomDataset => {
    const elements = normalizeDatasetElements(dataset.elements, transferSyntax, options);

    return {
        elements,
        elementCount: elements.length,
        totalElementCount: countNormalizedElements(elements),
        stoppedEarly: dataset.stoppedEarly,
        stopReason: dataset.stopReason,
    };
};
