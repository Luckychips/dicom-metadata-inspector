export type DicomExportFormat = 'json' | 'csv';
export type DicomExportSource = | 'metadata' | 'search' | 'comparison' | 'diagnostics';

export interface DicomExportOptions {
    includeSensitiveData?: boolean;
    includeBinaryData?: boolean;
    prettyPrint?: boolean;
    fileName?: string;
}

export interface DicomExportFile {
    fileName: string;
    mimeType: string;
    content: string;
}

export interface DicomExportElement {
    tag: string;
    formattedTag: string;
    name: string | null;
    keyword: string | null;
    vr: string | null;
    value: unknown;
    path: string;
    valueLength: number;
}

export interface DicomExportMetadataRow {
    fileId: string;
    fileName: string;
    studyInstanceUID: string;
    seriesInstanceUID: string;
    sopInstanceUID: string;
    path: string;
    tag: string;
    name: string;
    keyword: string;
    vr: string;
    value: string;
    valueLength: number;
}

export interface DicomExportSearchRow {
    fileId: string;
    fileName: string;
    studyInstanceUID: string;
    seriesInstanceUID: string;
    sopInstanceUID: string;
    path: string;
    tag: string;
    name: string;
    keyword: string;
    vr: string;
    value: string;
    matchedFields: string;
}

export interface DicomExportComparisonRow {
    path: string;
    tag: string;
    name: string;
    keyword: string;
    status: string;
    leftVR: string;
    rightVR: string;
    leftValue: string;
    rightValue: string;
}

export interface DicomExportDiagnosticRow {
    severity: string;
    code: string;
    message: string;
    path: string;
    tag: string;
    keyword: string;
}
