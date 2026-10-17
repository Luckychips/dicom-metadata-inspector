import { useCallback, useEffect, useRef, useState } from 'react';
import {
    groupDicomFiles,
    isDicomParseError,
    processDicomFiles,
    processDicomFilesInWorker,
    type CollectionResult,
    type DicomGroupingFile,
    type DicomGroupingResult,
    type DicomWorkerFileResult,
    type DicomWorkerValidationResult,
    type FileProcessResult,
} from '@/cores';

export type ParsedFileResult = DicomWorkerFileResult;

type ProcessStatus = 'idle' | 'collecting' | 'processing' | 'completed' | 'cancelled' | 'error';

export const useDicomFiles = () => {
    const controllerRef = useRef<AbortController | null>(null);
    const [parsedFiles, setParsedFiles] = useState<ParsedFileResult[]>([]);
    const [grouping, setGrouping] = useState<DicomGroupingResult | null>(null);
    const [validations, setValidations] = useState<DicomWorkerValidationResult[]>([]);
    const [status, setStatus] = useState<ProcessStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<FileProcessResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isBusy = status === 'collecting' || status === 'processing';

    const processFiles = useCallback(async (collect: (signal: AbortSignal) => Promise<CollectionResult>) => {
            if (controllerRef.current) {
                return;
            }

            const controller = new AbortController();
            controllerRef.current = controller;

            setParsedFiles([]);
            setGrouping(null);
            setValidations([]);
            setStatus('collecting');
            setProgress(0);
            setResult(null);
            setError(null);

            try {
                const collected = await collect(controller.signal);
                controller.signal.throwIfAborted();

                setStatus('processing');

                const output = await processDicomFiles(collected.files, {
                    signal: controller.signal,
                    onProgress: ({ percentage }) => {
                        if (!controller.signal.aborted) {
                            setProgress(Math.round(percentage * 0.1));
                        }
                    },
                });

                controller.signal.throwIfAborted();

                const workerResult = await processDicomFilesInWorker(
                    output.files.map(entry => ({
                        fileId: entry.id,
                        file: entry.file,
                    })), {
                        signal: controller.signal,
                        onProgress: ({ percentage }) => {
                            if (!controller.signal.aborted) {
                                setProgress(10 + Math.round(percentage * 0.9));
                            }
                        },
                    });

                controller.signal.throwIfAborted();

                const groupingFiles: DicomGroupingFile[] = workerResult.results.flatMap(entry => {
                        if (entry.parsed === null || entry.normalized === null) {
                            return [];
                        }

                        return [{
                            fileId: entry.fileId,
                            file: entry.file,
                            parsed: entry.parsed,
                            normalized: entry.normalized,
                        }];
                    });

                const groupingResult = groupDicomFiles(groupingFiles);

                controller.signal.throwIfAborted();

                setParsedFiles(workerResult.results);
                setValidations(workerResult.validations);
                setGrouping(groupingResult);

                setResult({
                    ...output,
                    errors: [...collected.errors, ...output.errors],
                });

                setProgress(100);
                setStatus('completed');
            } catch (err) {
                if (controller.signal.aborted) {
                    setStatus('cancelled');
                    return;
                }

                const message = isDicomParseError(err)
                    ? err.message
                    : err instanceof Error
                        ? err.message
                        : 'Unknown processing error';

                setError(message);
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

        setParsedFiles([]);
        setGrouping(null);
        setValidations([]);
        setStatus('idle');
        setProgress(0);
        setResult(null);
        setError(null);
    }, []);

    useEffect(() => {
        return () => {
            controllerRef.current?.abort();
        };
    }, []);

    return {
        parsedFiles,
        grouping,
        validations,
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
