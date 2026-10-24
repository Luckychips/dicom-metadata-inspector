import type { DicomGroupingResult, NormalizedDicomElement } from '@/cores';
import type {
    DicomExportFile,
    DicomExportFormat,
    DicomExportMetadataRow,
    DicomExportOptions,
} from './types';
import {
    createDicomCsvExport,
    createDicomJsonExport,
    formatExportPath,
    resolveExportOptions,
    shouldExportElement,
    stringifyExportValue,
    toExportValue,
} from './_';

const METADATA_COLUMNS = [
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
    'valueLength',
] as const;

interface ExportContext {
    fileId: string;
    fileName: string;
    studyInstanceUID: string;
    seriesInstanceUID: string;
    sopInstanceUID: string;
}

const serialize = (elements: readonly NormalizedDicomElement[], options: DicomExportOptions): unknown[] => {
    return elements.filter(element => shouldExportElement(element, options)).map(element => ({
        tag: element.tag,
        formattedTag: element.formattedTag,
        name: element.name,
        keyword: element.keyword,
        vr: element.vr,
        value: toExportValue(element.value, options.includeBinaryData),
        valueLength: element.valueLength,
        items: element.items?.map(item => ({
            index: item.index,
            elements: serialize(item.elements, options),
        })) ?? null,
    }));
}


const flatten = (
    elements: readonly NormalizedDicomElement[],
    context: ExportContext,
    options: DicomExportOptions,
    path: readonly {
        tag: string;
        itemIndex: number;
    }[] = []
): DicomExportMetadataRow[] => {
    const rows: DicomExportMetadataRow[] = [];

    for (const element of elements) {
        if (!shouldExportElement(element, options)) {
            continue;
        }

        rows.push({
            ...context,
            path: formatExportPath(path),
            tag: element.formattedTag,
            name: element.name ?? '',
            keyword: element.keyword ?? '',
            vr: element.vr ?? '',
            value: stringifyExportValue(toExportValue(element.value, options.includeBinaryData)),
            valueLength: element.valueLength,
        });

        for (const item of element.items ?? []) {
            rows.push(...flatten(item.elements, context, options,
                [...path, {
                    tag: element.tag,
                    itemIndex: item.index,
                }]
            ));
        }
    }

    return rows;
};

export const getDicomMetadata = (
    grouping: DicomGroupingResult,
    format: DicomExportFormat,
    options: DicomExportOptions = {}
): DicomExportFile => {
    const resolved = resolveExportOptions(options);
    if (format === 'json') {
        const studies = grouping.studies.map(study => ({
            studyInstanceUID: study.studyInstanceUID,
            series: study.series.map(series => ({
                seriesInstanceUID: series.seriesInstanceUID,
                seriesNumber: series.seriesNumber,
                modality: series.modality,
                description: series.description,
                instances: series.instances.map(instance => ({
                    fileId: instance.fileId,
                    fileName: instance.file.name,
                    sopInstanceUID: instance.sopInstanceUID,
                    instanceNumber: instance.instanceNumber,
                    transferSyntaxUID: instance.normalized.transferSyntax.uid,
                    metadata: serialize(instance.normalized.dataset.elements, resolved),
                })),
            })),
        }));

        return createDicomJsonExport({
            formatVersion: '1.0',
            source: 'dicom-metadata-inspector',
            studies,
            stats: grouping.stats,
        }, resolved);
    }

    const rows: DicomExportMetadataRow[] = [];
    for (const study of grouping.studies) {
        for (const series of study.series) {
            for (const instance of series.instances) {
                rows.push(...flatten(instance.normalized.dataset.elements, {
                    fileId: instance.fileId,
                    fileName: instance.file.name,
                    studyInstanceUID:
                    study.studyInstanceUID,
                    seriesInstanceUID:
                    series.seriesInstanceUID,
                    sopInstanceUID:
                    instance.sopInstanceUID,
                },
                resolved));
            }
        }
    }

    return createDicomCsvExport(rows, METADATA_COLUMNS, resolved);
};
