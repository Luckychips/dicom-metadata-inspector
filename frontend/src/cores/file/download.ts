import type { DicomExportFile } from '../dicom/export/types';

export const downloadDicomExport = (exported: DicomExportFile): void => {
    const blob = new Blob([exported.content], { type: exported.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = exported.fileName;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);

    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
};
