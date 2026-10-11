import { useCallback, useRef, useState } from 'react';
import {
    groupDicomFiles,
    isDicomParseError,
    normalizeDicomFile,
    parseDicomFile,
    processDicomFiles,
    type CollectionResult,
    type DicomGroupingFile,
    type DicomGroupingResult,
    type FileProcessResult,
    type NormalizedDicomFile,
    type ParsedDicomFile,
} from '@/cores';

export interface ParsedFileResult {
    fileId: string;
    file: File;
    parsed: ParsedDicomFile | null;
    normalized: NormalizedDicomFile | null;
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
    const [parsedFiles, setParsedFiles] = useState<ParsedFileResult[]>([]);
    const [grouping, setGrouping] = useState<DicomGroupingResult | null>(null);
    const [status, setStatus] = useState<ProcessStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<FileProcessResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isBusy = status === 'collecting' || status === 'processing';

    const processFiles = useCallback(
        async (collect: (signal: AbortSignal) => Promise<CollectionResult>) => {
            if (controllerRef.current) {
                return;
            }

            const controller = new AbortController();
            controllerRef.current = controller;

            setParsedFiles([]);
            setGrouping(null);
            setStatus('collecting');
            setProgress(0);
            setResult(null);
            setError(null);

            try {
                const collected = await collect(controller.signal);
                controller.signal.throwIfAborted();
                setStatus('processing');

                const output =
                    await processDicomFiles(
                        collected.files,
                        {
                            signal: controller.signal,
                            onProgress: ({ percentage }) => {
                                if (!controller.signal.aborted) {
                                    setProgress(percentage);
                                }
                            },
                        }
                    );

                controller.signal.throwIfAborted();
                const parsedResults: ParsedFileResult[] = [];

                for (const entry of output.files) {
                    controller.signal.throwIfAborted();

                    try {
                        const parsed = await parseDicomFile(entry.file,
                            { includePixelData: false },
                            controller.signal);

                        controller.signal.throwIfAborted();

                        const normalized = normalizeDicomFile(parsed);
                        parsedResults.push({
                            fileId: entry.id,
                            file: entry.file,
                            parsed,
                            normalized,
                        });
                    } catch (parseError) {
                        controller.signal.throwIfAborted();
                        const message = isDicomParseError(parseError)
                            ? parseError.message
                            : parseError instanceof Error
                                ? parseError.message
                                : 'Failed to parse DICOM file';

                        parsedResults.push({
                            fileId: entry.id,
                            file: entry.file,
                            parsed: null,
                            normalized: null,
                            error: message,
                        });
                    }
                }

                const groupingFiles: DicomGroupingFile[] = parsedResults.filter((result): result is ParsedFileResult & {
                    parsed: ParsedDicomFile;
                    normalized: NormalizedDicomFile;
                } => result.parsed !== null && result.normalized !== null).map(result => ({
                    fileId: result.fileId,
                    file: result.file,
                    parsed: result.parsed,
                    normalized: result.normalized,
                }));
                const groupingResult = groupDicomFiles(groupingFiles);

                controller.signal.throwIfAborted();

                setParsedFiles(parsedResults);
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

                /**
                 * 최상위에서도 DicomParseError가
                 * 올라올 가능성에 대비
                 */
                const message = isDicomParseError(err) ?
                    err.message :
                    err instanceof Error ? err.message : 'Unknown processing error';

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
        setStatus('idle');
        setProgress(0);
        setResult(null);
        setError(null);
    }, []);

    return {
        parsedFiles,
        grouping,
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
