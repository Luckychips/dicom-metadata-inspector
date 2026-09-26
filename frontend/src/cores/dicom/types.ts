export type DicomFileType = | 'part10-candidate' | 'unknown' | 'invalid';

export interface CollectedFile {
    file: File;
    path: string;
}

export interface DicomFileEntry {
    id: string;
    file: File;
    name: string;
    path: string;
    size: number;
    lastModified: number;
    type: DicomFileType;
}

export interface FileError {
    path: string;
    code: | 'EMPTY_FILE' | 'READ_ERROR' | 'COLLECTION_ERROR';
    message: string;
}

export interface FileProgress {
    processed: number;
    total: number;
    percentage: number;
}

export interface FileProcessResult {
    files: DicomFileEntry[];
    duplicates: string[];
    errors: FileError[];
}

export interface FileProcessOptions {
    signal?: AbortSignal;
    onProgress?: (progress: FileProgress) => void;
}
