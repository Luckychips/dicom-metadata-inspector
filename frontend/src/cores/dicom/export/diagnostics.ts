import type { DicomValidationResult } from '@/cores';
import type {
    DicomExportFile,
    DicomExportFormat,
    DicomExportOptions,
    DicomExportDiagnosticRow,
} from './types';
import { createDicomJsonExport } from './json';
import { createDicomCsvExport } from './csv';
import {
    formatExportPath,
    isSensitiveDicomTag,
    resolveExportOptions,
} from './utils';

const DIAGNOSTIC_COLUMNS = [
    'severity',
    'code',
    'message',
    'path',
    'tag',
    'keyword',
] as const;

export const exportDicomDiagnostics = (
    validation: DicomValidationResult,
    format: DicomExportFormat,
    options: DicomExportOptions = {}
): DicomExportFile => {
    const resolved = resolveExportOptions(options);
    const rows: DicomExportDiagnosticRow[] =
        validation.diagnostics.filter(diagnostic => resolved.includeSensitiveData || !diagnostic.tag || !isSensitiveDicomTag(diagnostic.tag))
            .map(diagnostic => ({
                severity: diagnostic.severity,
                code: diagnostic.code,
                message: diagnostic.message,
                path: formatExportPath(diagnostic.path),
                tag: diagnostic.formattedTag ?? '',
                keyword: diagnostic.keyword ?? '',
            }));

    if (format === 'json') {
        return createDicomJsonExport({
            valid: validation.valid,
            truncated: validation.truncated,
            stats: validation.stats,
            diagnostics: rows,
        }, resolved);
    }

    return createDicomCsvExport(rows, DIAGNOSTIC_COLUMNS, resolved);
};
