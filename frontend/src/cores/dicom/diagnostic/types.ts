import type { NormalizedDicomElement, NormalizedDicomFile } from '@/cores';

export type DicomDiagnosticSeverity = 'info' | 'warning' | 'error';
export type DicomDiagnosticCode = 'UNKNOWN_TAG'
    | 'UNKNOWN_VR'
    | 'UNDECODED_VALUE'
    | 'OMITTED_VALUE'
    | 'UNSUPPORTED_CHARACTER_SET'
    | 'MISSING_STUDY_INSTANCE_UID'
    | 'MISSING_SERIES_INSTANCE_UID'
    | 'MISSING_SOP_INSTANCE_UID'
    | 'INVALID_UID'
    | 'INVALID_ROWS'
    | 'INVALID_COLUMNS'
    | 'INVALID_BITS_ALLOCATED'
    | 'INVALID_BITS_STORED'
    | 'INVALID_HIGH_BIT'
    | 'INCONSISTENT_BITS'
    | 'EMPTY_SEQUENCE'
    | 'MAX_DIAGNOSTICS_EXCEEDED';

export interface DicomDiagnosticPathSegment {
    tag: string;
    keyword: string | null;
    itemIndex: number;
}

export interface DicomDiagnostic {
    code: DicomDiagnosticCode;
    severity: DicomDiagnosticSeverity;
    message: string;
    tag?: string;
    formattedTag?: string;
    keyword?: string | null;
    path: DicomDiagnosticPathSegment[];
}

export interface DicomValidationStats {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    totalCount: number;
}

export interface DicomValidationResult {
    valid: boolean;
    diagnostics: DicomDiagnostic[];
    stats: DicomValidationStats;
    truncated: boolean;
}

export interface DicomValidationOptions {
    recursive?: boolean;
    reportUnknownTags?: boolean;
    reportUndecodedValues?: boolean;
    maxDiagnostics?: number;
}

export interface DicomValidationContext {
    file: NormalizedDicomFile;
}

export interface DicomElementValidationContext {
    file: NormalizedDicomFile;
    element: NormalizedDicomElement;
    path: readonly DicomDiagnosticPathSegment[];
}
