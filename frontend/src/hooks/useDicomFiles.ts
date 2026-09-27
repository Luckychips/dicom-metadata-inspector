import { useCallback, useRef, useState } from 'react';
import {
    inspectFileHeader,
    processDicomFiles,
    type CollectionResult,
    type DicomHeaderInfo,
    type FileProcessResult,
} from '@/cores';

export interface InspectedHeader {
    fileId: string;
    header: DicomHeaderInfo | null;
    error?: string;
}

type ProcessStatus =
    | 'idle'
    | 'collecting'
    | 'processing'
    | 'completed'
    | 'cancelled'
    | 'error';

export const useDicomFiles = () => {
    const controllerRef = useRef<AbortController | null>(null);
    const [headers, setHeaders] = useState<InspectedHeader[]>([]);
    const [status, setStatus] = useState<ProcessStatus>("idle");
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<FileProcessResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isBusy = (status === 'collecting') || (status === 'processing');

    const processFiles = useCallback(
        async (
            collect: (
                signal: AbortSignal
            ) => Promise<CollectionResult>
        ) => {
            if (controllerRef.current) {
                return;
            }

            const controller = new AbortController();

            controllerRef.current = controller;

            setHeaders([]);
            setStatus('collecting');
            setProgress(0);
            setResult(null);
            setError(null);

            try {
                // 1. 파일 수집
                const collected = await collect(controller.signal);
                controller.signal.throwIfAborted();

                // 2. 파일 검사
                setStatus('processing');

                const output = await processDicomFiles(collected.files, {
                    signal: controller.signal,
                    onProgress: ({ percentage }) => {
                        if (!controller.signal.aborted) {
                            setProgress(percentage);
                        }
                    }}
                );

                controller.signal.throwIfAborted();

                // 3. Header 검사
                const inspectedHeaders: InspectedHeader[] = [];

                for (const entry of output.files) {
                    controller.signal.throwIfAborted();

                    try {
                        const header = await inspectFileHeader(entry, controller.signal);
                        controller.signal.throwIfAborted();

                        inspectedHeaders.push({
                            fileId: entry.id,
                            header,
                        });
                    } catch (error) {
                        controller.signal.throwIfAborted();
                        inspectedHeaders.push({
                            fileId: entry.id,
                            header: null,
                            error: error instanceof Error ? error.message : 'Header inspection failed',
                        });
                    }
                }

                controller.signal.throwIfAborted();
                setHeaders(inspectedHeaders);

                // 4. 수집 오류와 처리 오류 병합
                setResult({
                    ...output,
                    errors: [
                        ...collected.errors,
                        ...output.errors,
                    ],
                });

                setProgress(100);
                setStatus('completed');
            } catch (err) {
                if (controller.signal.aborted) {
                    setStatus('cancelled');
                    return;
                }

                setError(err instanceof Error ? err.message : 'Unknown processing error');
                setStatus('error');
            } finally {
                if (controllerRef.current === controller) {
                    controllerRef.current = null;
                }
            }
        },
        []
    );

    const cancel = useCallback(() => {
        controllerRef.current?.abort();
    }, []);

    const reset = useCallback(() => {
        if (controllerRef.current) {
            return;
        }

        setHeaders([]);
        setStatus('idle');
        setProgress(0);
        setResult(null);
        setError(null);
    }, []);

    return {
        headers,
        status,
        progress,
        result,
        error,
        isBusy,
        processFiles,
        cancel,
        reset,
    };
};
