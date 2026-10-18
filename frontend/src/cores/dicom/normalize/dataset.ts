import type {
    ParsedDataset,
    ParsedDataElement,
    TransferSyntax,
} from '@/cores';
import type { NormalizedDicomDataset, NormalizedDicomElement } from './types';
import type { NormalizeElementOptions } from './_';
import { normalizeDataElement } from './_';

/**
 * 중첩 Element 개수 계산
 */
const countNormalizedElements = (elements: readonly NormalizedDicomElement[]): number => {
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
const normalizeDatasetElements = (
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
