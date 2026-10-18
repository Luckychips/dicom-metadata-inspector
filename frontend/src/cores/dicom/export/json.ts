import type { DicomExportFile, DicomExportOptions } from './types';
import { createExportFileName, resolveExportOptions } from './_';

export const createDicomJsonExport = (data: unknown, options: DicomExportOptions = {}): DicomExportFile => {
    const resolved = resolveExportOptions(options);
    const content = JSON.stringify(data, null, resolved.prettyPrint ? 2 : undefined);

    return {
        fileName: createExportFileName(resolved.fileName, 'json'),
        mimeType: 'application/json;charset=utf-8',
        content,
    };
};
