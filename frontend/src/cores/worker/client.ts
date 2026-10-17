import type {
    DicomWorkerFileInput,
    DicomWorkerFileResult,
    DicomWorkerProcessOptions,
    DicomWorkerResponse,
    DicomWorkerValidationResult,
} from './types';

export interface DicomWorkerProcessResult {
    results: DicomWorkerFileResult[];
    validations: DicomWorkerValidationResult[];
}

export const processDicomFilesInWorker = (
    files: DicomWorkerFileInput[],
    options: DicomWorkerProcessOptions = {}
): Promise<DicomWorkerProcessResult> => {
    return new Promise((resolve, reject) => {
        if (options.signal?.aborted) {
            reject(new DOMException('Processing aborted', 'AbortError'));
            return;
        }

        const worker = new Worker(new URL('./dicom.worker.ts', import.meta.url), {
            type: 'module',
        });

        const requestId = crypto.randomUUID();

        let settled = false;

        const cleanup = (): void => {
            options.signal?.removeEventListener('abort', handleAbort);
            worker.terminate();
        };

        const finish = (callback: () => void): void => {
            if (settled) {
                return;
            }

            settled = true;
            cleanup();
            callback();
        };

        const handleAbort = (): void => {
            finish(() => {
                reject(new DOMException('Processing aborted', 'AbortError'));
            });
        };

        worker.onmessage = (event: MessageEvent<DicomWorkerResponse>): void => {
            const response = event.data;
            if (response.requestId !== requestId) {
                return;
            }

            if (response.type === 'PROGRESS') {
                options.onProgress?.({
                    completed: response.completed,
                    total: response.total,
                    percentage: response.percentage,
                });

                return;
            }

            if (response.type === 'ERROR') {
                finish(() => {
                    reject(new Error(response.message));
                });

                return;
            }

            if (response.type === 'RESULT') {
                finish(() => {
                    resolve({
                        results: response.results,
                        validations: response.validations,
                    });
                });
            }
        };

        worker.onerror = (event): void => {
            finish(() => {
                reject(new Error(event.message || 'DICOM Worker execution failed'));
            });
        };

        options.signal?.addEventListener('abort', handleAbort, {
            once: true,
        });

        if (options.signal?.aborted) {
            handleAbort();
            return;
        }

        worker.postMessage({
            type: 'PROCESS_FILES',
            requestId,
            files,
        });
    });
};
