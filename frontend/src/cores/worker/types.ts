import type { NormalizedDicomFile, ParsedDicomFile } from '@/cores';

export interface DicomWorkerFileInput {
    fileId: string;
    file: File;
}

export interface DicomWorkerFileResult {
    fileId: string;
    file: File;
    parsed: ParsedDicomFile | null;
    normalized: NormalizedDicomFile | null;
    error?: string;
}

export interface DicomWorkerValidationResult {
    fileId: string;
    valid: boolean;
    errorCount: number;
    warningCount: number;
}

export interface DicomWorkerRequest {
    type: 'PROCESS_FILES';
    requestId: string;
    files: DicomWorkerFileInput[];
}

export type DicomWorkerResponse =
    | {
    type: 'PROGRESS';
    requestId: string;
    completed: number;
    total: number;
    percentage: number;
}
    | {
    type: 'RESULT';
    requestId: string;
    results: DicomWorkerFileResult[];
    validations: DicomWorkerValidationResult[];
}
    | {
    type: 'ERROR';
    requestId: string;
    message: string;
};

export interface DicomWorkerProcessOptions {
    signal?: AbortSignal;
    onProgress?: (progress: {
        completed: number;
        total: number;
        percentage: number;
    }) => void;
}
