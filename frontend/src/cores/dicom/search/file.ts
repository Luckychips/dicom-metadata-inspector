import type { DicomGroupingResult } from '@/cores';
import { searchNormalizedDataset } from './dataset';
import type {
    DicomSearchField,
    DicomSearchOptions,
    DicomSearchResponse,
    DicomSearchScope,
} from './types';

const DEFAULT_FIELDS: readonly DicomSearchField[] = ['tag', 'keyword', 'name', 'value', 'vr'];
const DEFAULT_MAX_RESULTS = 1000;

const matchesScope = (
    scope: DicomSearchScope | undefined,
    studyInstanceUID: string,
    seriesInstanceUID: string,
    sopInstanceUID: string
): boolean => {
    if (!scope) {
        return true;
    }

    if (
        scope.studyInstanceUID !== undefined &&
        scope.studyInstanceUID !== studyInstanceUID
    ) {
        return false;
    }

    if (
        scope.seriesInstanceUID !== undefined &&
        scope.seriesInstanceUID !== seriesInstanceUID
    ) {
        return false;
    }

    if (
        scope.sopInstanceUID !== undefined &&
        scope.sopInstanceUID !== sopInstanceUID
    ) {
        return false;
    }

    return true;
};

const resolveMaxResults = (value: number | undefined): number => {
    if (value === undefined) {
        return DEFAULT_MAX_RESULTS;
    }

    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RangeError('maxResults must be a positive safe integer.');
    }

    return value;
};

export const searchDicomFiles = (
    grouping: DicomGroupingResult,
    query: string,
    options: DicomSearchOptions = {}
): DicomSearchResponse => {
    const trimmedQuery = query.trim();
    if (trimmedQuery === '') {
        return {
            query,
            results: [],
            totalMatches: 0,
            truncated: false,
        };
    }

    const fields = options.fields ?? DEFAULT_FIELDS;
    const caseSensitive = options.caseSensitive ?? false;
    const recursive = options.recursive ?? true;
    const maxResults = resolveMaxResults(options.maxResults);
    const results: DicomSearchResponse['results'] = [];
    let truncated = false;

    outer:
        for (const study of grouping.studies) {
            for (const series of study.series) {
                for (const instance of series.instances) {
                    if (!matchesScope(
                        options.scope,
                        study.studyInstanceUID,
                        series.seriesInstanceUID,
                        instance.sopInstanceUID
                    )) {
                        continue;
                    }

                    const remaining = maxResults - results.length;
                    if (remaining <= 0) {
                        truncated = true;
                        break outer;
                    }

                    const fileResult = searchNormalizedDataset(
                        instance.normalized.dataset.elements,
                        trimmedQuery,
                        {
                            fileId: instance.fileId,
                            file: instance.file,
                            studyInstanceUID: study.studyInstanceUID,
                            seriesInstanceUID: series.seriesInstanceUID,
                            sopInstanceUID: instance.sopInstanceUID,
                        },
                        {
                            fields,
                            caseSensitive,
                            recursive,
                            maxResults: remaining,
                        }
                    );

                    results.push(...fileResult.results);

                    if (fileResult.truncated) {
                        truncated = true;
                        break outer;
                    }

                    if (results.length >= maxResults) {
                        truncated = true;
                        break outer;
                    }
                }
            }
        }

    return {
        query,
        results,
        totalMatches: results.length,
        truncated,
    };
};
