import type { NormalizedDicomElement, NormalizedDicomItem } from '@/cores';
import type {
    DicomCompareOptions,
    DicomComparisonPathSegment,
    DicomComparisonStats,
    DicomDatasetComparison,
    DicomElementComparison,
} from './types';
import { compareDicomElement } from './element';
import { createIgnoredTagSet } from './utils';

interface ResolvedCompareOptions {
    recursive: boolean;
    includeSame: boolean;
    ignoredTags: Set<string>;
}

const resolveOptions = (options: DicomCompareOptions): ResolvedCompareOptions => ({
    recursive: options.recursive ?? true,
    includeSame: options.includeSame ?? true,
    ignoredTags: createIgnoredTagSet(options.ignoredTags),
});

const createElementMap = (
    elements: readonly NormalizedDicomElement[],
    ignoredTags: ReadonlySet<string>
): Map<string, NormalizedDicomElement> => {
    const map = new Map<string, NormalizedDicomElement>();
    for (const element of elements) {
        if (ignoredTags.has(element.tag)) {
            continue;
        }

        map.set(element.tag, element);
    }

    return map;
};

const createSequencePath = (
    path: readonly DicomComparisonPathSegment[],
    sequence: NormalizedDicomElement,
    itemIndex: number
): DicomComparisonPathSegment[] => [
    ...path, {
        tag: sequence.tag,
        keyword: sequence.keyword,
        itemIndex,
    },
];

const getItemElements = (item: NormalizedDicomItem | undefined): readonly NormalizedDicomElement[] => {
    return item?.elements ?? [];
};

const compareSequenceItems = (
    left: NormalizedDicomElement,
    right: NormalizedDicomElement,
    path: readonly DicomComparisonPathSegment[],
    options: ResolvedCompareOptions
): DicomElementComparison[] => {
    const leftItems = left.items ?? [];
    const rightItems = right.items ?? [];
    const maxItems = Math.max(leftItems.length, rightItems.length);
    const results: DicomElementComparison[] = [];
    for (let i = 0; i < maxItems; i++) {
        const itemPath = createSequencePath(path, left, i);
        results.push(...compareElementsRecursive(getItemElements(leftItems[i]), getItemElements(rightItems[i]), itemPath, options));
    }

    return results;
};

const compareElementsRecursive = (
    leftElements: readonly NormalizedDicomElement[],
    rightElements: readonly NormalizedDicomElement[],
    path: readonly DicomComparisonPathSegment[],
    options: ResolvedCompareOptions
): DicomElementComparison[] => {
    const leftMap = createElementMap(leftElements, options.ignoredTags);
    const rightMap = createElementMap(rightElements, options.ignoredTags);
    const tags = new Set<string>([...leftMap.keys(), ...rightMap.keys()]);
    const sortedTags = [...tags].sort();
    const results: DicomElementComparison[] = [];
    for (const tag of sortedTags) {
        const left = leftMap.get(tag) ?? null;
        const right = rightMap.get(tag) ?? null;
        const comparison = compareDicomElement(left, right, path);
        if (comparison.status !== 'SAME' || options.includeSame) {
            results.push(comparison);
        }

        if (!options.recursive || left === null || right === null) {
            continue;
        }

        if (left.vr !== 'SQ' || right.vr !== 'SQ') {
            continue;
        }

        results.push(...compareSequenceItems(left, right, path, options));
    }

    return results;
};

const createStats = (elements: readonly DicomElementComparison[]): DicomComparisonStats => {
    let sameCount = 0;
    let addedCount = 0;
    let removedCount = 0;
    let valueChangedCount = 0;
    let vrChangedCount = 0;

    for (const element of elements) {
        switch (element.status) {
            case 'SAME':
                sameCount++;
                break;
            case 'ADDED':
                addedCount++;
                break;
            case 'REMOVED':
                removedCount++;
                break;
            case 'VALUE_CHANGED':
                valueChangedCount++;
                break;
            case 'VR_CHANGED':
                vrChangedCount++;
                break;
        }
    }

    const changedCount = addedCount + removedCount + valueChangedCount + vrChangedCount;
    return {
        totalCount: elements.length,
        sameCount,
        addedCount,
        removedCount,
        valueChangedCount,
        vrChangedCount,
        changedCount,
    };
};

export const compareNormalizedDatasets = (
    leftElements: readonly NormalizedDicomElement[],
    rightElements: readonly NormalizedDicomElement[],
    options: DicomCompareOptions = {}
): DicomDatasetComparison => {
    const resolvedOptions = resolveOptions(options);
    const elements = compareElementsRecursive(leftElements, rightElements, [], resolvedOptions);
    const stats = createStats(elements);

    return {
        elements,
        stats,
        identical: stats.changedCount === 0,
    };
};
