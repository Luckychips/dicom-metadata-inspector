import type {
    DicomGroupingResult,
    NormalizedDicomElement,
    NormalizedDicomValue,
} from '@/cores';

export type DicomSearchField = 'tag' | 'keyword' | 'name' | 'value' | 'vr';

export interface DicomSearchScope {
    studyInstanceUID?: string;
    seriesInstanceUID?: string;
    sopInstanceUID?: string;
}

export interface DicomSearchOptions {
    fields?: readonly DicomSearchField[];
    caseSensitive?: boolean;
    recursive?: boolean;
    maxResults?: number;
    scope?: DicomSearchScope;
}

export interface DicomSearchPathSegment {
    tag: string;
    keyword: string | null;
    itemIndex: number;
}

export interface DicomSearchResult {
    fileId: string;
    file: File;
    studyInstanceUID: string;
    seriesInstanceUID: string;
    sopInstanceUID: string;
    element: NormalizedDicomElement;
    matchedFields: DicomSearchField[];
    path: DicomSearchPathSegment[];
    displayValue: string | null;
}

export interface DicomSearchResponse {
    query: string;
    results: DicomSearchResult[];
    totalMatches: number;
    truncated: boolean;
}

export interface DicomDatasetSearchContext {
    fileId: string;
    file: File;
    studyInstanceUID: string;
    seriesInstanceUID: string;
    sopInstanceUID: string;
}

export type DicomSearchSource = DicomGroupingResult;
export type SearchableDicomValue = NormalizedDicomValue;
