import { createExportFileName, resolveExportOptions, stringifyExportValue } from './utils';
import type { DicomExportFile, DicomExportOptions } from './types';

const escapeCsvCell = (value: unknown): string => {
    let text = stringifyExportValue(value);

    // Spreadsheet formula injection 방지
    if (/^[\s]*[=+\-@]/.test(text)) {
        text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
};

export const createDicomCsvExport = <T extends object>(
    rows: readonly T[],
    columns: readonly (Extract<keyof T, string>)[],
    options: DicomExportOptions = {}
): DicomExportFile => {
    const resolved = resolveExportOptions(options);
    const header = columns.map(escapeCsvCell).join(',');
    const body = rows.map(row => columns.map(column => escapeCsvCell(row[column])).join(','));
    const content = '\uFEFF' + [header, ...body].join('\r\n');

    return {
        fileName: createExportFileName(resolved.fileName, 'csv'),
        mimeType: 'text/csv;charset=utf-8',
        content,
    };
};
