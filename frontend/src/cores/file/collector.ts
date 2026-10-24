import type { CollectedFile, CollectionResult } from './types';

type DropSource = {
    kind: 'entry';
    entry: FileSystemEntry;
} | {
    kind: 'file';
    file: File;
};

const getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : 'Unknown collection error';
};

const readFileEntry = (entry: FileSystemFileEntry): Promise<File> => {
    return new Promise((resolve, reject) => {
        entry.file(resolve, reject);
    });
};

const readDirectoryEntries = (entry: FileSystemDirectoryEntry, signal?: AbortSignal): Promise<FileSystemEntry[]> => {
    const reader = entry.createReader();
    const entries: FileSystemEntry[] = [];

    return new Promise((resolve, reject) => {
        const readNext = (): void => {
            try {
                signal?.throwIfAborted();
                reader.readEntries((batch) => {
                    try {
                        signal?.throwIfAborted();
                        if (batch.length === 0) {
                            resolve(entries);
                            return;
                        }

                        entries.push(...batch);
                        readNext();
                    } catch (error) {
                        reject(error);
                    }
                }, reject);
            } catch (error) {
                reject(error);
            }
        };

        readNext();
    });
};

const toCollect = async (entry: FileSystemEntry, result: CollectionResult, signal?: AbortSignal): Promise<void> => {
    signal?.throwIfAborted();
    if (entry.isFile) {
        try {
            const file = await readFileEntry(entry as FileSystemFileEntry);
            signal?.throwIfAborted();
            result.files.push({
                file,
                path: entry.fullPath,
            });
        } catch (error) {
            signal?.throwIfAborted();
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
        children = await readDirectoryEntries(entry as FileSystemDirectoryEntry, signal);
    } catch (error) {
        signal?.throwIfAborted();

        result.errors.push({
            path: entry.fullPath,
            code: 'COLLECTION_ERROR',
            message: getErrorMessage(error),
        });

        return;
    }

    for (const child of children) {
        signal?.throwIfAborted();
        await toCollect(child, result, signal);
    }
};

export const getCollectedFiles = (fileList: FileList): CollectionResult => {
    const files = Array.from(fileList).map((file): CollectedFile => {
        return {
            file,
            path: file.webkitRelativePath || file.name,
        }
    });

    return {
        files,
        errors: [],
    };
};

export const getCapturedSources = (transfer: DataTransfer): DropSource[] => {
    const items = Array.from(transfer.items);
    const fileItems = items.filter(item => item.kind === 'file');
    if (fileItems.length === 0) {
        return Array.from(transfer.files).map(file => ({ kind: 'file' as const, file }));
    }

    return fileItems.flatMap((item): DropSource[] => {
        const entry = item.webkitGetAsEntry?.();

        if (entry) {
            return [{
                kind: 'entry',
                entry,
            }];
        }

        const file = item.getAsFile();
        return file ? [{ kind: 'file', file }] : [];
    });
};

export const getCollectDroppedFiles = async (sources: DropSource[], signal?: AbortSignal): Promise<CollectionResult> => {
    const result: CollectionResult = {
        files: [],
        errors: [],
    };

    for (const source of sources) {
        signal?.throwIfAborted();
        if (source.kind === 'file') {
            result.files.push({
                file: source.file,
                path: source.file.name,
            });

            continue;
        }

        await toCollect(source.entry, result, signal);
    }

    return result;
};
