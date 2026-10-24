import { useState } from 'react';
import {
    download,
    getDicomMetadata,
    type DicomGroupingResult,
    type DicomExportFormat,
} from '@/cores';

interface Props {
    grouping: DicomGroupingResult | null;
}

const MetadataExport = ({ grouping }: Props) => {
    const [format, setFormat] = useState<DicomExportFormat>('json');
    const [includeSensitiveData, setIncludeSensitiveData] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExport = () => {
        if (!grouping) {
            return;
        }

        setError(null);

        try {
            const exported = getDicomMetadata(grouping, format, {
                includeSensitiveData,
                includeBinaryData: false,
                prettyPrint: true,
                fileName: 'dicom-metadata',
            });

            download(exported);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Failed to export DICOM metadata');
        }
    };

    return (
        <section>
            <h2>Metadata Export</h2>
            <div>
                <label htmlFor="dicom-export-format">Export format</label>
                <select
                    id="dicom-export-format"
                    value={format}
                    onChange={event => setFormat(event.target.value as DicomExportFormat)}>
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                </select>
            </div>
            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={includeSensitiveData}
                        onChange={event => setIncludeSensitiveData(event.target.checked)} />
                    Include sensitive metadata
                </label>
            </div>
            <p>
                The export is generated locally
                in your browser.
            </p>
            <button
                type="button"
                disabled={!grouping || grouping.stats.instanceCount === 0}
                onClick={handleExport}>
                Export {format.toUpperCase()}
            </button>
            {error && <p role="alert">{error}</p>}
        </section>
    );
};

export default MetadataExport;
