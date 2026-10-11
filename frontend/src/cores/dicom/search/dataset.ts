import type { NormalizedDicomElement } from '@/cores';
import { dicomValueToSearchText, getMatchedSearchFields } from './utils';
import type {
    DicomDatasetSearchContext,
    DicomSearchField,
    DicomSearchPathSegment,
    DicomSearchResult,
} from './types';

export interface SearchDatasetOptions {
    fields: readonly DicomSearchField[];
    caseSensitive: boolean;
    recursive: boolean;
    maxResults: number;
}

interface SearchState {
    query: string;
    context: DicomDatasetSearchContext;
    options: SearchDatasetOptions;
    results: DicomSearchResult[];
    truncated: boolean;
}

const addSearchResult = (
    state: SearchState,
    element: NormalizedDicomElement,
    matchedFields: DicomSearchField[],
    path: readonly DicomSearchPathSegment[]
): void => {
    if (state.results.length >= state.options.maxResults) {
        state.truncated = true;
        return;
    }

    state.results.push({
        fileId: state.context.fileId,
        file: state.context.file,
        studyInstanceUID: state.context.studyInstanceUID,
        seriesInstanceUID: state.context.seriesInstanceUID,
        sopInstanceUID: state.context.sopInstanceUID,
        element,
        matchedFields,
        path: [...path],
        displayValue: dicomValueToSearchText(element.value),
    });
};

const searchElementsRecursive = (
    elements: readonly NormalizedDicomElement[],
    path: readonly DicomSearchPathSegment[],
    state: SearchState
): void => {
    for (const element of elements) {
        if (state.results.length >= state.options.maxResults) {
            state.truncated = true;
            return;
        }

        const matchedFields = getMatchedSearchFields(element, state.query, state.options.fields, state.options.caseSensitive);

        if (matchedFields.length > 0) {
            addSearchResult(state, element, matchedFields, path);
        }

        if (!state.options.recursive || !element.items || element.items.length === 0) {
            continue;
        }

        for (const item of element.items) {
            const nestedPath:
                DicomSearchPathSegment[] = [
                ...path, {
                    tag: element.tag,
                    keyword: element.keyword,
                    itemIndex: item.index,
                },
            ];

            searchElementsRecursive(item.elements, nestedPath, state);

            if (state.truncated) {
                return;
            }
        }
    }
};

export const searchNormalizedDataset = (
    elements: readonly NormalizedDicomElement[],
    query: string,
    context: DicomDatasetSearchContext,
    options: SearchDatasetOptions
): {
    results: DicomSearchResult[];
    truncated: boolean;
} => {
    const state: SearchState = {
        query,
        context,
        options,
        results: [],
        truncated: false,
    };

    searchElementsRecursive(elements, [], state);

    return {
        results: state.results,
        truncated: state.truncated,
    };
};
