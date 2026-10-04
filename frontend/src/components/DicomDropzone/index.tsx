import {
    useState,
    type ChangeEvent,
    type DragEvent,
} from 'react';
import {
    collectSelectedFiles,
    captureDropSources,
    collectDroppedFiles,
} from '@/cores';
import { useDicomFiles } from '@/hooks/useDicomFiles';

// 파일 크기 표시
const formatFileSize = (size: number): string => {
    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const DicomDropzone = () => {
    const [isDragging, setIsDragging] = useState(false);
    const {
        status,
        progress,
        result,
        parsedFiles,
        error,
        isBusy,
        processFiles,
        cancel,
        reset,
    } = useDicomFiles();

    // 일반 파일 및 폴더 선택
    const handleFileChange = (
        event: ChangeEvent<HTMLInputElement>
    ): void => {
        const input = event.currentTarget;

        if (!input.files || isBusy) {
            return;
        }

        const collected = collectSelectedFiles(input.files);

        // 같은 파일을 다시 선택할 수 있도록 초기화
        input.value = '';

        void processFiles(async signal => {
            signal.throwIfAborted();
            return collected;
        });
    };

    // Drag & Drop
    const handleDrop = (
        event: DragEvent<HTMLDivElement>
    ): void => {
        event.preventDefault();
        setIsDragging(false);

        if (isBusy) {
            return;
        }

        // Drop 이벤트 내에서 동기적으로 확보
        const sources = captureDropSources(event.dataTransfer);
        void processFiles(
            signal => collectDroppedFiles(
                sources,
                signal
            )
        );
    };

    const totalFiles = result?.files.length ?? 0;
    const part10Count = result?.files.filter(file => file.type === 'part10-candidate').length ?? 0;
    const unknownCount = result?.files.filter(file => file.type === 'unknown').length ?? 0;
    const duplicateCount = result?.duplicates.length ?? 0;
    const errorCount = result?.errors.length ?? 0;
    const parsedFileMap = new Map(parsedFiles.map(item => [item.fileId, item]));

    return (
        <main className="inspector">
            {/* 제목 */}
            <header>
                <h1>DICOM Metadata Inspector</h1>
                <p>Browser-based DICOM metadata inspection</p>
            </header>

            {/* 파일 입력 */}
            <section
                className={`dropzone ${isDragging ? "dragging" : ""}`}
                onDragEnter={event => {
                    event.preventDefault();

                    if (!isBusy) {
                        setIsDragging(true);
                    }
                }}
                onDragOver={event => {
                    event.preventDefault();
                }}
                onDragLeave={event => {
                    event.preventDefault();

                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setIsDragging(false);
                    }
                }}
                onDrop={handleDrop}>
                <h2>Drop DICOM files here</h2>
                <p>
                    Files are processed locally
                    in your browser.
                </p>
                <div className="actions">
                    {/* 다중 파일 선택 */}
                    <label className="file-button">
                        Select Files
                        <input
                            type="file"
                            multiple
                            disabled={isBusy}
                            onChange={handleFileChange}
                        />
                    </label>

                    {/* 폴더 선택 */}
                    <label className="file-button">
                        Select Folder
                        <input
                            type="file"
                            multiple
                            disabled={isBusy}
                            ref={element => {
                                element?.setAttribute(
                                    "webkitdirectory",
                                    ""
                                );
                            }}
                            onChange={handleFileChange}
                        />
                    </label>
                </div>
            </section>

            {/* 진행률 */}
            {isBusy && (
                <section className="progress-panel">
                    <h3>{status === "collecting" ? "Collecting files..." : "Inspecting files..."}</h3>
                    {status === "processing" && (
                        <>
                            <progress value={progress} max={100}/>
                            <p>{progress}%</p>
                        </>
                    )}
                    <button type="button" onClick={cancel}>Cancel</button>
                </section>
            )}

            {/* 작업 취소 */}
            {status === "cancelled" && (<p role="status">Operation cancelled.</p>)}

            {/* 전체 오류 */}
            {error && (<p role="alert">{error}</p>)}

            {/* 검사 결과 */}
            {result && (
                <section className="results">
                    <div className="result-header">
                        <h2>Inspection Results</h2>
                        <button type="button" onClick={reset}>Clear</button>
                    </div>

                    {/* 검사 요약 */}
                    <div className="summary">
                        <p>Total: {totalFiles}</p>
                        <p>Part 10 candidates: {part10Count}</p>
                        <p>Unknown: {unknownCount}</p>
                        <p>Duplicates: {duplicateCount}</p>
                        <p>Errors: {errorCount}</p>
                    </div>

                    {/* 파일별 Header 검사 결과 */}
                    <h3>File Headers</h3>
                    <div className="table-container">
                        <table className="dicom-table">
                            <thead>
                            <tr>
                                <th>File</th>
                                <th>Size</th>
                                <th>Detection</th>
                                <th>Prefix</th>
                                <th>First Tag</th>
                                <th>Status</th>
                            </tr>
                            </thead>

                            <tbody>
                                {result.files.map(file => {
                                    const parseResult = parsedFileMap.get(file.id);
                                    const parsed = parseResult?.parsed;

                                    return (
                                        <tr key={file.id}>
                                            <td>{file.path}</td>
                                            <td>{formatFileSize(file.size)}</td>
                                            <td>{file.type}</td>
                                            <td>{parsed?.isPart10 ? 'Yes' : '-'}</td>
                                            <td>{parsed?.fileMeta.transferSyntaxUID ?? '-'}</td>
                                            <td>{parsed?.fileMeta.elements.length ?? '-'}</td>
                                            <td>{parsed?.dataset.elements.length ?? '-'}</td>
                                            <td>
                                                {parseResult?.error
                                                    ? parseResult.error
                                                    : parsed?.dataset.stoppedEarly
                                                        ? `Partial: ${parsed.dataset.stopReason}`
                                                        : parsed ? 'Parsed' : 'Pending'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* 중복 파일 */}
                    {duplicateCount > 0 && (
                        <section>
                            <h3>Duplicate Candidates</h3>
                            <ul>
                                {result.duplicates.map(
                                    (path, index) => (<li key={`${path}-${index}`}>{path}</li>)
                                )}
                            </ul>
                        </section>
                    )}

                    {/* 파일별 오류 */}
                    {errorCount > 0 && (
                        <section>
                            <h3>File Errors</h3>
                            <ul>
                                {result.errors.map(
                                    (item, index) => (
                                        <li key={index}>
                                            <strong>{item.path}</strong>{" — "}{item.message}
                                        </li>
                                    )
                                )}
                            </ul>
                        </section>
                    )}
                </section>
            )}
        </main>
    );
};
