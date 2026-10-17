import type { NormalizedDicomElement, NormalizedDicomValue } from '@/cores';
import type { DicomExportOptions } from './types';

const SENSITIVE_TAGS = new Set([
    '00100010', // PatientName
    '00100020', // PatientID
    '00100030', // PatientBirthDate
    '00100040', // PatientSex
    '00080050', // AccessionNumber
    '00080080', // InstitutionName
    '00080090', // ReferringPhysicianName
]);

export const resolveExportOptions = (
    options: DicomExportOptions = {}
): Required<DicomExportOptions> => ({
    includeSensitiveData: options.includeSensitiveData ?? false,
    includeBinaryData: options.includeBinaryData ?? false,
    prettyPrint: options.prettyPrint ?? true,
    fileName: options.fileName ?? 'dicom-metadata',
});

export const isSensitiveDicomTag = (tag: string): boolean => SENSITIVE_TAGS.has(tag.toUpperCase());

export const shouldExportElement = (
    element: NormalizedDicomElement,
    options: DicomExportOptions
): boolean => {
    return !(!options.includeSensitiveData && isSensitiveDicomTag(element.tag));
};

export const formatExportPath = (
    path: readonly {
        tag: string;
        itemIndex: number;
    }[]
): string => path.map(item => `${item.tag}[${item.itemIndex}]`).join('/');

export const toExportValue = (
    value: NormalizedDicomValue,
    includeBinaryData = false
): unknown => {
    if (value === null) {
        return null;
    }

    if (value instanceof Uint8Array) {
        return includeBinaryData ? Array.from(value) : `[Binary: ${value.byteLength} bytes]`;
    }

    if (typeof value === 'bigint') {
        return value.toString();
    }

    if (Array.isArray(value)) {
        return value.map(item => toExportValue(item, includeBinaryData));
    }

    if (typeof value === 'object') {
        return value;
    }

    return value;
};

export const stringifyExportValue = (value: unknown): string => {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }

    return JSON.stringify(value);
};

export const sanitizeExportFileName = (value: string): string => {
    return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 180) || 'dicom-export';
}

export const createExportFileName = (name: string, extension: 'json' | 'csv'): string => {
    const sanitized = sanitizeExportFileName(name).replace(/\.(json|csv)$/i, '');
    return `${sanitized}.${extension}`;
};
