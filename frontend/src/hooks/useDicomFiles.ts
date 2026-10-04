import { useCallback, useRef, useState } from 'react';
import {
    isDicomParseError,
    parseDicomFile,
    processDicomFiles,
    type CollectionResult,
    type FileProcessResult,
    type ParsedDicomFile,
} from '@/cores';

export interface ParsedFileResult {
    fileId: string;
    parsed: ParsedDicomFile | null;
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

    /**
     * [FR-03 변경]
     *
     * 기존:
     *
     * const [headers, setHeaders] =
     *     useState<InspectedHeader[]>([]);
     */
    const [parsedFiles, setParsedFiles] = useState<ParsedFileResult[]>([]);
    const [status, setStatus] = useState<ProcessStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<FileProcessResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isBusy = status === 'collecting' || status === 'processing';

    const processFiles = useCallback(
        async (
            collect: (signal: AbortSignal) => Promise<CollectionResult>
        ) => {
            if (controllerRef.current) {
                return;
            }

            const controller = new AbortController();
            controllerRef.current = controller;

            setParsedFiles([]);
            setStatus('collecting');
            setProgress(0);
            setResult(null);
            setError(null);

            try {
                // ---------------------------------
                // 1. FR-01 파일 수집
                // ---------------------------------

                const collected = await collect(controller.signal);

                controller.signal.throwIfAborted();

                // ---------------------------------
                // 2. FR-01 파일 처리
                // ---------------------------------

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

                // ---------------------------------
                // 3. FR-03 DICOM 파싱
                // ---------------------------------

                const parsedResults: ParsedFileResult[] = [];

                for (const entry of output.files) {
                    controller.signal.throwIfAborted();

                    try {
                        const parsed = await parseDicomFile(entry.file,
                            { includePixelData: false },
                            controller.signal);

                        controller.signal.throwIfAborted();

                        parsedResults.push({
                            fileId: entry.id,
                            parsed,
                        });
                    } catch (parseError) {
                        controller.signal.throwIfAborted();

                        /**
                         * FR-03은 class 기반 Error가 아닌
                         * DicomParseError 객체도 사용하므로
                         * isDicomParseError() 확인 필요
                         */
                        const message = isDicomParseError(parseError) ?
                            parseError.message :
                            parseError instanceof Error ? parseError.message : 'Failed to parse DICOM file';

                        parsedResults.push({
                            fileId: entry.id,
                            parsed: null,
                            error: message,
                        });
                    }
                }

                controller.signal.throwIfAborted();

                setParsedFiles(parsedResults);

                // ---------------------------------
                // 4. 수집 오류 + 처리 오류 병합
                // ---------------------------------

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
        setStatus('idle');
        setProgress(0);
        setResult(null);
        setError(null);
    }, []);

    return {
        parsedFiles,
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
