import type {
    DicomDiagnostic,
    DicomValidationOptions,
    DicomValidationResult,
    NormalizedDicomElement,
    NormalizedDicomFile,
} from '@/cores';
import {
    createValidationStats,
    findNormalizedElement,
    isValidDicomUID,
    toNormalizedNumber,
} from '@/cores';
import { validateDatasetElements } from './_';

const addFileDiagnostic = (
    diagnostics: DicomDiagnostic[],
    diagnostic: Omit<DicomDiagnostic, 'path'>
): void => {
    diagnostics.push({ ...diagnostic, path: [] });
};

const validateUID = (
    diagnostics: DicomDiagnostic[],
    value: string | null,
    code: 'MISSING_STUDY_INSTANCE_UID' | 'MISSING_SERIES_INSTANCE_UID' | 'MISSING_SOP_INSTANCE_UID',
    label: string,
): void => {
    if (value === null || value.trim() === '') {
        addFileDiagnostic(diagnostics, {
            code,
            severity: 'error',
            message: `${label} is missing.`,
        });

        return;
    }

    if (!isValidDicomUID(value)) {
        addFileDiagnostic(diagnostics, {
            code: 'INVALID_UID',
            severity: 'error',
            message: `${label} is not a valid DICOM UID: ${value}`,
        });
    }
};

const getNumber = (
    elements: readonly NormalizedDicomElement[],
    group: number,
    element: number
): number | null => {
    const found = findNormalizedElement(elements, group, element);
    if (!found) {
        return null;
    }

    return toNormalizedNumber(found.value);
};

const validateImagePixelModule = (
    elements: readonly NormalizedDicomElement[],
    diagnostics: DicomDiagnostic[]
): void => {
    const rows = getNumber(elements, 0x0028, 0x0010);
    const columns = getNumber(elements, 0x0028, 0x0011);
    const bitsAllocated = getNumber(elements, 0x0028, 0x0100);
    const bitsStored = getNumber(elements, 0x0028, 0x0101);
    const highBit = getNumber(elements, 0x0028, 0x0102);
    if (rows !== null && (!Number.isInteger(rows) || rows <= 0)) {
        addFileDiagnostic(diagnostics, {
            code: 'INVALID_ROWS',
            severity: 'error',
            message: `Rows must be a positive integer: ${rows}`,
            tag: '00280010',
            formattedTag: '(0028,0010)',
            keyword: 'Rows',
        });
    }

    if (columns !== null && (!Number.isInteger(columns) || columns <= 0)) {
        addFileDiagnostic(diagnostics, {
            code: 'INVALID_COLUMNS',
            severity: 'error',
            message: `Columns must be a positive integer: ${columns}`,
            tag: '00280011',
            formattedTag: '(0028,0011)',
            keyword: 'Columns',
        });
    }

    if (bitsAllocated !== null && (!Number.isInteger(bitsAllocated) || bitsAllocated <= 0)) {
        addFileDiagnostic(diagnostics, {
            code: 'INVALID_BITS_ALLOCATED',
            severity: 'error',
            message: `Bits Allocated is invalid: ${bitsAllocated}`,
            tag: '00280100',
            formattedTag: '(0028,0100)',
            keyword: 'BitsAllocated',
        });
    }

    if (bitsStored !== null && (!Number.isInteger(bitsStored) || bitsStored <= 0)) {
        addFileDiagnostic(diagnostics, {
            code: 'INVALID_BITS_STORED',
            severity: 'error',
            message: `Bits Stored is invalid: ${bitsStored}`,
            tag: '00280101',
            formattedTag: '(0028,0101)',
            keyword: 'BitsStored',
        });
    }

    if (highBit !== null && (!Number.isInteger(highBit) || highBit < 0)) {
        addFileDiagnostic(diagnostics, {
            code: 'INVALID_HIGH_BIT',
            severity: 'error',
            message: `High Bit is invalid: ${highBit}`,
            tag: '00280102',
            formattedTag: '(0028,0102)',
            keyword: 'HighBit',
        });
    }

    if (bitsAllocated !== null && bitsStored !== null && bitsStored > bitsAllocated) {
        addFileDiagnostic(diagnostics, {
            code: 'INCONSISTENT_BITS',
            severity: 'error',
            message: `Bits Stored (${bitsStored}) exceeds Bits Allocated (${bitsAllocated}).`,
        });
    }

    if (bitsStored !== null && highBit !== null && highBit + 1 < bitsStored) {
        addFileDiagnostic(diagnostics, {
            code: 'INCONSISTENT_BITS',
            severity: 'error',
            message: `High Bit (${highBit}) is inconsistent with Bits Stored (${bitsStored}).`,
        });
    }
};

export const validateDicomFile = (
    file: NormalizedDicomFile,
    options: DicomValidationOptions = {}
): DicomValidationResult => {
    const datasetResult = validateDatasetElements(file.dataset.elements, options);
    const diagnostics = [...datasetResult.diagnostics];
    if (!file.characterSet.supported) {
        addFileDiagnostic(diagnostics, {
            code: 'UNSUPPORTED_CHARACTER_SET',
            severity: 'warning',
            message: `Unsupported Specific Character Set: ${file.characterSet.values.join('\\') || 'unknown'}`,
        });
    }

    validateUID(diagnostics, file.summary.studyInstanceUID, 'MISSING_STUDY_INSTANCE_UID', 'Study Instance UID');
    validateUID(diagnostics, file.summary.seriesInstanceUID, 'MISSING_SERIES_INSTANCE_UID', 'Series Instance UID');
    validateUID(diagnostics, file.summary.sopInstanceUID, 'MISSING_SOP_INSTANCE_UID', 'SOP Instance UID');
    validateImagePixelModule(file.dataset.elements, diagnostics);

    const stats = createValidationStats(diagnostics);

    return {
        valid: stats.errorCount === 0,
        diagnostics,
        stats,
        truncated: datasetResult.truncated,
    };
};
