import type { DicomFileComparison } from '@/cores';
import type {
    DicomExportFile,
    DicomExportFormat,
    DicomExportOptions,
    DicomExportComparisonRow,
} from './types';
import {
    createDicomCsvExport,
    createDicomJsonExport,
    formatExportPath,
    isSensitiveDicomTag,
    resolveExportOptions,
    stringifyExportValue,
    toExportValue,
} from './_';

const COMPARISON_COLUMNS = [
    'path',
    'tag',
    'name',
    'keyword',
    'status',
    'leftVR',
    'rightVR',
    'leftValue',
    'rightValue',
] as const;

export const exportDicomComparison = (
    comparison: DicomFileComparison,
    format: DicomExportFormat,
    options: DicomExportOptions = {}
): DicomExportFile => {
    const resolved = resolveExportOptions(options);
    const rows: DicomExportComparisonRow[] = comparison.dataset.elements
        .filter(element => resolved.includeSensitiveData || !isSensitiveDicomTag(element.tag))
        .map(element => ({
            path: formatExportPath(element.path),
            tag: element.formattedTag,
            name: element.name ?? '',
            keyword: element.keyword ?? '',
            status: element.status,
            leftVR: element.leftVR ?? '',
            rightVR: element.rightVR ?? '',
            leftValue: stringifyExportValue(toExportValue(element.leftValue, resolved.includeBinaryData)),
            rightValue: stringifyExportValue(toExportValue(element.rightValue, resolved.includeBinaryData)),
        }));

    if (format === 'json') {
        return createDicomJsonExport({
            leftFileName: comparison.left.file.name,
            rightFileName: comparison.right.file.name,
            identical: comparison.identical,
            stats: comparison.dataset.stats,
            differences: rows,
        }, resolved);
    }

    return createDicomCsvExport(rows, COMPARISON_COLUMNS, resolved);
};
