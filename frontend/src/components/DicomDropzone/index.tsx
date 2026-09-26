import {
    useRef,
    type ChangeEvent,
    type DragEvent,
} from 'react';
import {
    collectSelectedFiles,
    captureDropSources,
    collectDroppedFiles,
} from '@/cores';
import { useDicomFiles } from '@/hooks/useDicomFiles';

export const DicomDropzone = () => {
    const folderInputRef =
        useRef<HTMLInputElement | null>(null);

    const {
        status,
        progress,
        result,
        error,
        isBusy,
        processFiles,
        cancel,
        reset,
    } = useDicomFiles();

    // 일반 파일 및 폴더 선택
    const handleFileChange = (
        event: ChangeEvent<HTMLInputElement>
    ) => {
        const input = event.currentTarget;

        if (!input.files || isBusy) {
            return;
        }

        const collected = collectSelectedFiles(
            input.files
        );

        input.value = "";

        void processFiles(
            async signal => {
                signal.throwIfAborted();
                return collected;
            }
        );
    };

    // Drag & Drop
    const handleDrop = (
        event: DragEvent<HTMLDivElement>
    ) => {
        event.preventDefault();

        if (isBusy) {
            return;
        }

        // Drop 이벤트 중 동기적으로 확보
        const sources = captureDropSources(
            event.dataTransfer
        );

        void processFiles(
            signal => collectDroppedFiles(
                sources,
                signal
            )
        );
    };

    const part10Count =
        result?.files.filter(
            file => file.type === "part10-candidate"
        ).length ?? 0;

    const unknownCount =
        result?.files.filter(
            file => file.type === "unknown"
        ).length ?? 0;

    return (
        <main className="inspector">
            <header>
                <h1>DICOM Metadata Inspector</h1>
                <p>
                    Browser-based DICOM file inspection
                </p>
            </header>

            <section
                className="dropzone"
                onDragOver={event => {
                    event.preventDefault();
                }}
                onDrop={handleDrop}
            >
                <h2>Drop DICOM files here</h2>

                <p>
                    Files are processed locally
                    in your browser.
                </p>

                <div className="actions">
                    <label className="file-button">
                        Select Files

                        <input
                            type="file"
                            multiple
                            disabled={isBusy}
                            onChange={handleFileChange}
                        />
                    </label>

                    <label className="file-button">
                        Select Folder

                        <input
                            ref={element => {
                                folderInputRef.current = element;

                                if (element) {
                                    element.setAttribute(
                                        "webkitdirectory",
                                        ""
                                    );
                                }
                            }}
                            type="file"
                            multiple
                            disabled={isBusy}
                            onChange={handleFileChange}
                        />
                    </label>
                </div>
            </section>

            {isBusy && (
                <section className="progress-panel">
                    <p>
                        {status === "collecting"
                            ? "Collecting files..."
                            : "Inspecting files..."}
                    </p>

                    {status === "processing" && (
                        <>
                            <progress
                                value={progress}
                                max={100}
                            />

                            <span>{progress}%</span>
                        </>
                    )}

                    <button onClick={cancel}>
                        Cancel
                    </button>
                </section>
            )}

            {status === "cancelled" && (
                <p role="status">
                    Operation cancelled.
                </p>
            )}

            {error && (
                <p role="alert">
                    {error}
                </p>
            )}

            {result && (
                <section className="results">
                    <div className="result-header">
                        <h2>Inspection Results</h2>

                        <button onClick={reset}>
                            Clear
                        </button>
                    </div>

                    <div className="summary">
                        <p>
                            Total: {result.files.length}
                        </p>

                        <p>
                            Part 10 candidates: {part10Count}
                        </p>

                        <p>
                            Unknown: {unknownCount}
                        </p>

                        <p>
                            Duplicates: {result.duplicates.length}
                        </p>

                        <p>
                            Errors: {result.errors.length}
                        </p>
                    </div>

                    <h3>Files</h3>

                    <ul className="file-list">
                        {result.files.map(file => (
                            <li key={file.id}>
                                <span>{file.path}</span>

                                <span>
                  {(file.size / 1024).toFixed(1)}
                                    {" KB"}
                </span>

                                <span>{file.type}</span>
                            </li>
                        ))}
                    </ul>

                    {result.duplicates.length > 0 && (
                        <>
                            <h3>Duplicate candidates</h3>

                            <ul>
                                {result.duplicates.map(
                                    (path, index) => (
                                        <li key={`${path}-${index}`}>
                                            {path}
                                        </li>
                                    )
                                )}
                            </ul>
                        </>
                    )}

                    {result.errors.length > 0 && (
                        <>
                            <h3>Errors</h3>

                            <ul>
                                {result.errors.map(
                                    (item, index) => (
                                        <li key={index}>
                                            {item.path}: {item.message}
                                        </li>
                                    )
                                )}
                            </ul>
                        </>
                    )}
                </section>
            )}
        </main>
    );
};
