import type { NormalizedDicomElement } from '@/cores';
import type {
    DicomDiagnostic,
    DicomDiagnosticPathSegment,
    DicomValidationOptions,
} from '../diagnostic/types';

const createElementDiagnostic = (
    element: NormalizedDicomElement,
    path: readonly DicomDiagnosticPathSegment[],
    diagnostic: Omit<DicomDiagnostic, | 'tag' | 'formattedTag' | 'keyword' | 'path'>
): DicomDiagnostic => ({
    ...diagnostic,
    tag: element.tag,
    formattedTag: element.formattedTag,
    keyword: element.keyword,
    path: [...path],
});

export const validateDicomElement = (
    element: NormalizedDicomElement,
    path: readonly DicomDiagnosticPathSegment[],
    options: Required<Pick<DicomValidationOptions, | 'reportUnknownTags' | 'reportUndecodedValues'>>
): DicomDiagnostic[] => {
    const diagnostics: DicomDiagnostic[] = [];
    if (options.reportUnknownTags && !element.isKnown && !element.isPrivate) {
        diagnostics.push(
            createElementDiagnostic(element, path, {
                code: 'UNKNOWN_TAG',
                severity: 'info',
                message: `Unknown DICOM tag ${element.formattedTag}.`,
            })
        );
    }

    if (element.vr === null) {
        diagnostics.push(
            createElementDiagnostic(element, path, {
                code: 'UNKNOWN_VR',
                severity: 'warning',
                message: `Unable to resolve VR for ${element.formattedTag}.`,
            })
        );
    }

    if (options.reportUndecodedValues && !element.isDecoded && !element.isBinary && !element.isValueOmitted) {
        diagnostics.push(
            createElementDiagnostic(element, path, {
                code: 'UNDECODED_VALUE',
                severity: 'warning',
                message: `Value could not be decoded for ${element.formattedTag}.`,
            })
        );
    }

    if (element.isValueOmitted) {
        diagnostics.push(
            createElementDiagnostic(element, path, {
                code: 'OMITTED_VALUE',
                severity: 'info',
                message: `Value was not loaded for ${element.formattedTag}.`,
            })
        );
    }

    return diagnostics;
};
