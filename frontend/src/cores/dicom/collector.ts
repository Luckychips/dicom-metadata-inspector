import type { CollectedFile, FileError } from './types';

export interface CollectionResult {
    files: CollectedFile[];
    errors: FileError[];
}

type DropSource =
    | {
    kind: 'entry';
    entry: FileSystemEntry;
}
    | {
    kind: 'file';
    file: File;
};

const checkAborted = (signal?: AbortSignal): void => {
    signal?.throwIfAborted();
};

const getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : 'Unknown collection error';
};

// 일반 파일 및 폴더 선택
export const collectSelectedFiles = (fileList: FileList): CollectionResult => {
    const files = Array.from(fileList).map(
        (file): CollectedFile => ({
            file,
            path: file.webkitRelativePath || file.name,
        })
    );

    return {
        files,
        errors: [],
    };
};

// FileSystemFileEntry -> File
const readFileEntry = (entry: FileSystemFileEntry): Promise<File> => {
    return new Promise((resolve, reject) => {
        entry.file(resolve, reject);
    });
};

// 디렉터리의 모든 Entry 조회
const readDirectoryEntries = (
    entry: FileSystemDirectoryEntry,
    signal?: AbortSignal
): Promise<FileSystemEntry[]> => {
    const reader = entry.createReader();
    const entries: FileSystemEntry[] = [];

    return new Promise((resolve, reject) => {
        const readNext = (): void => {
            try {
                checkAborted(signal);

                reader.readEntries(
                    (batch) => {
                        try {
                            checkAborted(signal);

                            if (batch.length === 0) {
                                resolve(entries);
                                return;
                            }

                            entries.push(...batch);
                            readNext();
                        } catch (error) {
                            reject(error);
                        }
                    },
                    reject
                );
            } catch (error) {
                reject(error);
            }
        };

        readNext();
    });
};

// 파일 또는 폴더 재귀 탐색
const collectEntry = async (
    entry: FileSystemEntry,
    result: CollectionResult,
    signal?: AbortSignal
): Promise<void> => {
    checkAborted(signal);

    if (entry.isFile) {
        try {
            const file = await readFileEntry(entry as FileSystemFileEntry);
            checkAborted(signal);

            result.files.push({
                file,
                path: entry.fullPath,
            });
        } catch (error) {
            checkAborted(signal);

            result.errors.push({
                path: entry.fullPath,
                code: 'COLLECTION_ERROR',
                message: getErrorMessage(error),
            });
        }

        return;
    }

    if (!entry.isDirectory) {
        return;
    }

    let children: FileSystemEntry[];

    try {
        children = await readDirectoryEntries(
            entry as FileSystemDirectoryEntry,
            signal
        );
    } catch (error) {
        checkAborted(signal);

        result.errors.push({
            path: entry.fullPath,
            code: 'COLLECTION_ERROR',
            message: getErrorMessage(error),
        });

        return;
    }

    for (const child of children) {
        checkAborted(signal);

        await collectEntry(child, result, signal);
    }
};

// Drop 이벤트 중 동기적으로 호출
export const captureDropSources = (transfer: DataTransfer): DropSource[] => {
    const items = Array.from(transfer.items);

    const fileItems = items.filter(
        item => item.kind === 'file'
    );

    if (fileItems.length === 0) {
        return Array.from(transfer.files).map(
            file => ({kind: 'file' as const, file})
        );
    }

    return fileItems.flatMap(
        (item): DropSource[] => {
            const entry =
                item.webkitGetAsEntry?.();

            if (entry) {
                return [{
                    kind: 'entry',
                    entry,
                }];
            }

            const file = item.getAsFile();

            return file
                ? [{ kind: "file", file }]
                : [];
        }
    );
};

// 캡처한 Drop 데이터를 비동기적으로 수집
export const collectDroppedFiles = async (
    sources: DropSource[],
    signal?: AbortSignal
): Promise<CollectionResult> => {
    const result: CollectionResult = {
        files: [],
        errors: [],
    };

    for (const source of sources) {
        checkAborted(signal);

        if (source.kind === 'file') {
            result.files.push({
                file: source.file,
                path: source.file.name,
            });

            continue;
        }

        await collectEntry(
            source.entry,
            result,
            signal
        );
    }

    return result;
};
