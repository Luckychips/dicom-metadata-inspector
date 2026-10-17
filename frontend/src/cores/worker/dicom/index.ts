/// <reference lib="webworker" />

console.log('set workers');

import {
    isDicomParseError,
    normalizeDicomFile,
    parseDicomFile,
    validateDicomFile,
} from '@/cores';
import type {
    DicomWorkerFileResult,
    DicomWorkerRequest,
    DicomWorkerResponse,
    DicomWorkerValidationResult,
} from '@/cores';

const workerScope = self as DedicatedWorkerGlobalScope;

const postResponse = (response: DicomWorkerResponse): void => {
    workerScope.postMessage(response);
};

const getErrorMessage = (error: unknown): string => {
    if (isDicomParseError(error)) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Unknown DICOM processing error';
};

workerScope.onmessage = async (event: MessageEvent<DicomWorkerRequest>): Promise<void> => {
    const request = event.data;
    if (request.type !== 'PROCESS_FILES') {
        return;
    }

    const { requestId, files } = request;

    const results: DicomWorkerFileResult[] = [];
    const validations: DicomWorkerValidationResult[] = [];

    try {
        for (let i = 0; i < files.length; i++) {
            const entry = files[i];

            try {
                const parsed = await parseDicomFile(entry.file, {
                    includePixelData: false,
                });

                const normalized = normalizeDicomFile(parsed);
                const validation = validateDicomFile(normalized);

                results.push({
                    fileId: entry.fileId,
                    file: entry.file,
                    parsed,
                    normalized,
                });

                validations.push({
                    fileId: entry.fileId,
                    valid: validation.valid,
                    errorCount: validation.stats.errorCount,
                    warningCount: validation.stats.warningCount,
                });
            } catch (error) {
                results.push({
                    fileId: entry.fileId,
                    file: entry.file,
                    parsed: null,
                    normalized: null,
                    error: getErrorMessage(error),
                });
            }

            const completed = i + 1;

            postResponse({
                type: 'PROGRESS',
                requestId,
                completed,
                total: files.length,
                percentage: files.length === 0 ? 100 : Math.round((completed / files.length) * 100),
            });
        }

        postResponse({
            type: 'RESULT',
            requestId,
            results,
            validations,
        });
    } catch (error) {
        postResponse({
            type: 'ERROR',
            requestId,
            message: getErrorMessage(error),
        });
    }
};

export {};
