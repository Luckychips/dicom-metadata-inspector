import type { NormalizedDicomFile, ParsedDicomFile } from '@/cores';

export interface DicomGroupingFile {
    fileId: string;
    file: File;
    parsed: ParsedDicomFile;
    normalized: NormalizedDicomFile;
}

export interface DicomInstanceGroup {
    sopInstanceUID: string;
    instanceNumber: number | null;
    fileId: string;
    file: File;
    parsed: ParsedDicomFile;
    normalized: NormalizedDicomFile;
}

export interface DicomSeriesGroup {
    seriesInstanceUID: string;
    seriesNumber: number | null;
    modality: string | null;
    description: string | null;
    instances: DicomInstanceGroup[];
}

export interface DicomStudyGroup {
    studyInstanceUID: string;
    studyDate: string | null;
    studyTime: string | null;
    description: string | null;
    patientName: string | null;
    patientID: string | null;
    series: DicomSeriesGroup[];
}

export type DicomGroupingIssueCode =
    | 'MISSING_STUDY_INSTANCE_UID'
    | 'MISSING_SERIES_INSTANCE_UID'
    | 'MISSING_SOP_INSTANCE_UID'
    | 'DUPLICATE_SOP_INSTANCE_UID';

export interface DicomGroupingIssue {
    code: DicomGroupingIssueCode;
    fileId: string;
    file: File;
    message: string;
    studyInstanceUID?: string;
    seriesInstanceUID?: string;
    sopInstanceUID?: string;
    existingFileId?: string;
}

export interface DicomGroupingStats {
    inputFileCount: number;
    groupedFileCount: number;
    studyCount: number;
    seriesCount: number;
    instanceCount: number;
    issueCount: number;
    duplicateInstanceCount: number;
    missingUIDCount: number;
}

export interface DicomGroupingResult {
    studies: DicomStudyGroup[];
    issues: DicomGroupingIssue[];
    stats: DicomGroupingStats;
}
