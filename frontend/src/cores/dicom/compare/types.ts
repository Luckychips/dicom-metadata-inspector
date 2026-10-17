import type {
    NormalizedDicomElement,
    NormalizedDicomFile,
    NormalizedDicomValue,
} from '@/cores';

export type DicomComparisonStatus = 'SAME' | 'ADDED' | 'REMOVED' | 'VALUE_CHANGED' | 'VR_CHANGED';

export interface DicomComparisonPathSegment {
    tag: string;
    keyword: string | null;
    itemIndex: number;
}

export interface DicomElementComparison {
    tag: string;
    formattedTag: string;
    name: string | null;
    keyword: string | null;
    path: DicomComparisonPathSegment[];
    status: DicomComparisonStatus;
    leftElement: NormalizedDicomElement | null;
    rightElement: NormalizedDicomElement | null;
    leftVR: NormalizedDicomElement['vr'];
    rightVR: NormalizedDicomElement['vr'];
    leftValue: NormalizedDicomValue;
    rightValue: NormalizedDicomValue;
}

export interface DicomComparisonStats {
    totalCount: number;
    sameCount: number;
    addedCount: number;
    removedCount: number;
    valueChangedCount: number;
    vrChangedCount: number;
    changedCount: number;
}

export interface DicomDatasetComparison {
    elements: DicomElementComparison[];
    stats: DicomComparisonStats;
    identical: boolean;
}

export interface DicomFileComparisonSource {
    fileId: string;
    file: File;
    normalized: NormalizedDicomFile;
}

export interface DicomFileComparison {
    left: DicomFileComparisonSource;
    right: DicomFileComparisonSource;
    dataset: DicomDatasetComparison;
    identical: boolean;
}

export interface DicomCompareOptions {
    /**
     * SQ 내부까지 비교.
     *
     * 기본 true.
     */
    recursive?: boolean;

    /**
     * SAME 결과 포함 여부.
     *
     * 기본 true.
     *
     * false라면 차이가 있는 Element만 반환한다.
     */
    includeSame?: boolean;
    ignoredTags?: readonly string[];
}
