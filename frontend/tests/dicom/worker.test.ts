import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { processDicomFilesInWorker } from '@/cores';
import type { DicomWorkerFileInput } from '@/cores';
import { createDicomFixture } from '../fixtures/dicom';

type WorkerResponse =
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
    results: [];
    validations: [];
}
    | {
    type: 'ERROR';
    requestId: string;
    message: string;
};

type ProcessRequest = {
    type: 'PROCESS_FILES';
    requestId: string;
    files: DicomWorkerFileInput[];
};

class MockWorker {
    static instances: MockWorker[] = [];

    onmessage:
        | ((event: MessageEvent<WorkerResponse>) => void)
        | null = null;

    onerror:
        | ((event: ErrorEvent) => void)
        | null = null;

    postMessage = vi.fn<(message: ProcessRequest) => void>();

    terminate = vi.fn<() => void>();

    constructor() {
        MockWorker.instances.push(this);
    }

    emitMessage(response: WorkerResponse): void {
        this.onmessage?.({
            data: response,
        } as MessageEvent<WorkerResponse>);
    }

    emitError(message: string): void {
        this.onerror?.({
            message,
        } as ErrorEvent);
    }

    getRequest(): ProcessRequest {
        const request = this.postMessage.mock.calls[0]?.[0];

        if (!request) {
            throw new Error('Worker request not found');
        }

        return request;
    }

    getRequestId(): string {
        return this.getRequest().requestId;
    }
}

describe('DICOM Worker Client', () => {
    let files: DicomWorkerFileInput[];
    let worker: MockWorker;

    const startProcessing = (
        options: Parameters<typeof processDicomFilesInWorker>[1] = {},
    ) => {
        const promise = processDicomFilesInWorker(files, options);
        const instance = MockWorker.instances.at(-1);

        if (!instance) {
            throw new Error('Worker was not created');
        }

        worker = instance;

        return promise;
    };

    beforeEach(() => {
        MockWorker.instances = [];
        vi.stubGlobal('Worker', MockWorker);
        vi.stubGlobal('crypto', {
            randomUUID: vi.fn()
                .mockReturnValueOnce('request-1')
                .mockReturnValueOnce('request-2')
                .mockReturnValueOnce('request-3'),
        });

        const buffer = createDicomFixture({
            studyInstanceUID: '1.2.826.0.1.3680043.10.1000.1',
            seriesInstanceUID: '1.2.826.0.1.3680043.10.1000.10',
            sopInstanceUID: '1.2.826.0.1.3680043.10.1000.101',
            patientID: 'PAT001',
            patientName: 'ALPHA_PATIENT',
            modality: 'CT',
        });

        files = [
            {
                fileId: 'file-1',
                file: new File(
                    [buffer],
                    'test-1.dcm',
                    { type: 'application/dicom' },
                ),
            },
        ];
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('Worker initialization', () => {
        it('creates a Worker', async () => {
            const promise = startProcessing();

            expect(MockWorker.instances).toHaveLength(1);

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            await promise;
        });

        it('posts a PROCESS_FILES request', async () => {
            const promise = startProcessing();

            expect(worker.postMessage).toHaveBeenCalledOnce();

            expect(worker.getRequest()).toEqual({
                type: 'PROCESS_FILES',
                requestId: 'request-1',
                files,
            });

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            await promise;
        });

        it('creates unique request IDs for separate calls', async () => {
            const firstPromise = startProcessing();
            const firstWorker = worker;

            const secondPromise = startProcessing();
            const secondWorker = worker;

            expect(firstWorker.getRequestId()).toBe('request-1');
            expect(secondWorker.getRequestId()).toBe('request-2');

            firstWorker.emitMessage({
                type: 'RESULT',
                requestId: firstWorker.getRequestId(),
                results: [],
                validations: [],
            });

            secondWorker.emitMessage({
                type: 'RESULT',
                requestId: secondWorker.getRequestId(),
                results: [],
                validations: [],
            });

            await Promise.all([firstPromise, secondPromise]);
        });
    });

    describe('Progress handling', () => {
        it('invokes onProgress when PROGRESS is received', async () => {
            const onProgress = vi.fn();
            const promise = startProcessing({ onProgress });

            worker.emitMessage({
                type: 'PROGRESS',
                requestId: worker.getRequestId(),
                completed: 1,
                total: 2,
                percentage: 50,
            });

            expect(onProgress).toHaveBeenCalledWith({
                completed: 1,
                total: 2,
                percentage: 50,
            });

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            await promise;
        });

        it('supports multiple progress updates', async () => {
            const onProgress = vi.fn();
            const promise = startProcessing({ onProgress });

            worker.emitMessage({
                type: 'PROGRESS',
                requestId: worker.getRequestId(),
                completed: 1,
                total: 2,
                percentage: 50,
            });

            worker.emitMessage({
                type: 'PROGRESS',
                requestId: worker.getRequestId(),
                completed: 2,
                total: 2,
                percentage: 100,
            });

            expect(onProgress).toHaveBeenCalledTimes(2);

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            await promise;
        });

        it('ignores progress from another request ID', async () => {
            const onProgress = vi.fn();
            const promise = startProcessing({ onProgress });

            worker.emitMessage({
                type: 'PROGRESS',
                requestId: 'unknown-request',
                completed: 1,
                total: 1,
                percentage: 100,
            });

            expect(onProgress).not.toHaveBeenCalled();

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            await promise;
        });
    });

    describe('Result handling', () => {
        it('resolves with results and validations', async () => {
            const promise = startProcessing();

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            await expect(promise).resolves.toEqual({
                results: [],
                validations: [],
            });
        });

        it('ignores results from another request ID', async () => {
            const promise = startProcessing();

            worker.emitMessage({
                type: 'RESULT',
                requestId: 'unknown-request',
                results: [],
                validations: [],
            });

            expect(worker.terminate).not.toHaveBeenCalled();

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            await expect(promise).resolves.toEqual({
                results: [],
                validations: [],
            });
        });

        it('terminates the Worker after a result', async () => {
            const promise = startProcessing();

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            await promise;

            expect(worker.terminate).toHaveBeenCalledOnce();
        });
    });

    describe('Error handling', () => {
        it('rejects when the Worker sends ERROR', async () => {
            const promise = startProcessing();

            worker.emitMessage({
                type: 'ERROR',
                requestId: worker.getRequestId(),
                message: 'Invalid DICOM file',
            });

            await expect(promise).rejects.toThrow(
                'Invalid DICOM file',
            );

            expect(worker.terminate).toHaveBeenCalledOnce();
        });

        it('rejects on Worker runtime error', async () => {
            const promise = startProcessing();
            worker.emitError('Worker execution failed');
            await expect(promise).rejects.toThrow('Worker execution failed');
            expect(worker.terminate).toHaveBeenCalledOnce();
        });

        it('uses the fallback message for empty runtime errors', async () => {
            const promise = startProcessing();
            worker.emitError('');
            await expect(promise).rejects.toThrow('DICOM Worker execution failed');
        });

        it('ignores errors from another request ID', async () => {
            const promise = startProcessing();

            worker.emitMessage({
                type: 'ERROR',
                requestId: 'unknown-request',
                message: 'Unrelated error',
            });

            expect(worker.terminate).not.toHaveBeenCalled();

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            await expect(promise).resolves.toEqual({
                results: [],
                validations: [],
            });
        });
    });

    describe('Abort handling', () => {
        it('rejects immediately when already aborted', async () => {
            const controller = new AbortController();
            controller.abort();

            await expect(processDicomFilesInWorker(files, {
                signal: controller.signal,
            })).rejects.toMatchObject({
                name: 'AbortError',
                message: 'Processing aborted',
            });

            expect(MockWorker.instances).toHaveLength(0);
        });

        it('aborts an active request', async () => {
            const controller = new AbortController();
            const promise = startProcessing({
                signal: controller.signal,
            });

            controller.abort();

            await expect(promise).rejects.toMatchObject({
                name: 'AbortError',
                message: 'Processing aborted',
            });

            expect(worker.terminate).toHaveBeenCalledOnce();
        });

        it('does not settle twice after cancellation', async () => {
            const controller = new AbortController();

            const promise = startProcessing({
                signal: controller.signal,
            });

            controller.abort();

            await expect(promise).rejects.toMatchObject({
                name: 'AbortError',
            });

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            expect(worker.terminate).toHaveBeenCalledOnce();
        });
    });

    describe('Cleanup and consistency', () => {
        it('terminates only once after repeated terminal responses', async () => {
            const promise = startProcessing();

            const response: WorkerResponse = {
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            };

            worker.emitMessage(response);
            worker.emitMessage(response);

            await promise;

            expect(worker.terminate).toHaveBeenCalledOnce();
        });

        it('does not modify the input files array', async () => {
            const originalFiles = [...files];

            const promise = startProcessing();

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            await promise;

            expect(files).toEqual(originalFiles);
        });

        it('does not invoke onProgress after completion', async () => {
            const onProgress = vi.fn();
            const promise = startProcessing({ onProgress });

            worker.emitMessage({
                type: 'RESULT',
                requestId: worker.getRequestId(),
                results: [],
                validations: [],
            });

            await promise;

            worker.emitMessage({
                type: 'PROGRESS',
                requestId: worker.getRequestId(),
                completed: 1,
                total: 1,
                percentage: 100,
            });

            expect(onProgress).not.toHaveBeenCalled();
        });
    });
});
