import type { DicomSearchResponse } from '@/cores';
import type {
    DicomExportFile,
    DicomExportFormat,
    DicomExportOptions,
    DicomExportSearchRow,
} from './types';
import { createDicomJsonExport } from './json';
import { createDicomCsvExport } from './csv';
import { formatExportPath, resolveExportOptions, isSensitiveDicomTag } from './utils';

const SEARCH_COLUMNS = [
    'fileId',
    'fileName',
    'studyInstanceUID',
    'seriesInstanceUID',
    'sopInstanceUID',
    'path',
    'tag',
    'name',
    'keyword',
    'vr',
    'value',
    'matchedFields',
] as const;

export const exportDicomSearch = (
    response: DicomSearchResponse,
    format: DicomExportFormat,
    options: DicomExportOptions = {}
): DicomExportFile => {
    const resolved = resolveExportOptions(options);
    const rows: DicomExportSearchRow[] = response.results
        .filter(result => resolved.includeSensitiveData || !isSensitiveDicomTag(result.element.tag))
        .map(result => ({
            fileId: result.fileId,
            fileName: result.file.name,
            studyInstanceUID:
            result.studyInstanceUID,
            seriesInstanceUID:
            result.seriesInstanceUID,
            sopInstanceUID:
            result.sopInstanceUID,
            path: formatExportPath(result.path),
            tag: result.element.formattedTag,
            name: result.element.name ?? '',
            keyword: result.element.keyword ?? '',
            vr: result.element.vr ?? '',
            value: result.element.isBinary ? '[Binary]' : result.displayValue ?? '',
            matchedFields: result.matchedFields.join(','),
        }));

    if (format === 'json') {
        return createDicomJsonExport({
            query: response.query,
            truncated: response.truncated,
            results: rows,
        }, resolved);
    }

    return createDicomCsvExport(rows, SEARCH_COLUMNS, resolved);
};
