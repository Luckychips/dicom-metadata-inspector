import type {
    CollectedFile,
    FileProcessOptions,
    FileProcessResult,
} from './types';

export const processDicomFiles = async (
    input: CollectedFile[],
    options: FileProcessOptions = {}
): Promise<FileProcessResult> => {
    const { signal, onProgress } = options;

    const files: FileProcessResult['files'] = [];
    const duplicates: FileProcessResult['duplicates'] = [];
    const errors: FileProcessResult['errors'] = [];

    const seen = new Set<string>();

    const total = input.length;

    onProgress?.({ processed: 0, total, percentage: 0 });

    for (let index = 0; index < input.length; index += 1) {
        signal?.throwIfAborted();

        const { file, path } = input[index];
        try {
            // 빈 파일 검사
            if (file.size === 0) {
                errors.push({
                    path,
                    code: 'EMPTY_FILE',
                    message: 'File is empty',
                });

                continue;
            }

            // 기존 중복 검사 로직은 그대로 유지
            const duplicateKey = [file.name, file.size, file.lastModified].join(':');
            if (seen.has(duplicateKey)) {
                duplicates.push(path);
                continue;
            }

            seen.add(duplicateKey);
            files.push({
                id: crypto.randomUUID(),
                file,
                name: file.name,
                path,
                size: file.size,
                lastModified: file.lastModified,
            });
        } catch (error) {
            signal?.throwIfAborted();
            errors.push({
                path,
                code: 'READ_ERROR',
                message: error instanceof Error ? error.message : 'Failed to process file',
            });
        } finally {
            const processed = index + 1;
            onProgress?.({
                processed,
                total,
                percentage: total === 0
                    ? 100
                    : Math.round((processed / total) * 100),
            });
        }
    }

    signal?.throwIfAborted();

    return {
        files,
        duplicates,
        errors,
    };
};
