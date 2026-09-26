import { detectDicomFile } from './detector';
import { createFileKey, isDuplicate } from './duplicate';
import type {
    CollectedFile,
    DicomFileEntry,
    FileProcessOptions,
    FileProcessResult,
} from './types';

const getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : 'Unknown file error';
};

export const processDicomFiles = async (
    input: CollectedFile[],
    options: FileProcessOptions = {}
): Promise<FileProcessResult> => {
    const { signal, onProgress } = options;
    const existingKeys = new Set<string>();
    const result: FileProcessResult = {
        files: [],
        duplicates: [],
        errors: [],
    };

    const total = input.length;

    signal?.throwIfAborted();

    onProgress?.({
        processed: 0,
        total,
        percentage: total === 0 ? 100 : 0,
    });

    for (const [index, entry] of input.entries()) {
        signal?.throwIfAborted();

        const { file, path } = entry;

        try {
            // 1. 중복 검사
            if (isDuplicate(entry, existingKeys)) {
                result.duplicates.push(path);
                continue;
            }

            // 2. 파일 후보 식별
            const type = await detectDicomFile(file, signal);
            signal?.throwIfAborted();

            // 3. 빈 파일 처리
            if (type === 'invalid') {
                result.errors.push({
                    path,
                    code: 'EMPTY_FILE',
                    message: 'File is empty',
                });

                continue;
            }

            // 4. 파일 정보 생성
            const fileEntry: DicomFileEntry = {
                id: crypto.randomUUID(),

                file,
                name: file.name,
                path,
                size: file.size,
                lastModified: file.lastModified,

                type,
            };

            // 5. 처리 결과 반영
            result.files.push(fileEntry);
            existingKeys.add(createFileKey(entry));
        } catch (error) {
            signal?.throwIfAborted();

            result.errors.push({
                path,
                code: 'READ_ERROR',
                message: getErrorMessage(error),
            });
        } finally {
            const processed = index + 1;

            onProgress?.({
                processed,
                total,
                percentage: Math.round(
                    (processed / total) * 100
                ),
            });
        }
    }

    return result;
};
