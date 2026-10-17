import type { NormalizedDicomElement } from '@/cores';
import type {
    DicomDiagnostic,
    DicomDiagnosticPathSegment,
    DicomValidationOptions,
} from '../diagnostic/types';
import { validateDicomElement } from './element';

interface ResolvedValidationOptions {
    recursive: boolean;
    reportUnknownTags: boolean;
    reportUndecodedValues: boolean;
    maxDiagnostics: number;
}

interface ValidationState {
    diagnostics: DicomDiagnostic[];
    options: ResolvedValidationOptions;
    truncated: boolean;
}

const DEFAULT_MAX_DIAGNOSTICS = 1000;

const resolveOptions = (options: DicomValidationOptions): ResolvedValidationOptions => {
    const maxDiagnostics = options.maxDiagnostics ?? DEFAULT_MAX_DIAGNOSTICS;
    if (!Number.isSafeInteger(maxDiagnostics) || maxDiagnostics <= 0) {
        throw new RangeError('maxDiagnostics must be a positive safe integer.');
    }

    return {
        recursive: options.recursive ?? true,
        reportUnknownTags: options.reportUnknownTags ?? true,
        reportUndecodedValues: options.reportUndecodedValues ?? true,
        maxDiagnostics,
    };
};

const pushDiagnostic = (state: ValidationState, diagnostic: DicomDiagnostic): boolean => {
    if (state.diagnostics.length >= state.options.maxDiagnostics) {
        state.truncated = true;
        return false;
    }

    state.diagnostics.push(diagnostic);
    return true;
};

const validateElementsRecursive = (
    elements: readonly NormalizedDicomElement[],
    path: readonly DicomDiagnosticPathSegment[],
    state: ValidationState
): void => {
    for (const element of elements) {
        if (state.truncated) {
            return;
        }

        const diagnostics = validateDicomElement(element, path, {
            reportUnknownTags: state.options.reportUnknownTags,
            reportUndecodedValues: state.options.reportUndecodedValues,
        });

        for (const diagnostic of diagnostics) {
            if (!pushDiagnostic(state, diagnostic)) {
                return;
            }
        }

        if (!state.options.recursive || !element.items) {
            continue;
        }

        for (const item of element.items) {
            const itemPath: DicomDiagnosticPathSegment[] = [...path, {
                tag: element.tag,
                keyword: element.keyword,
                itemIndex: item.index,
            }];

            validateElementsRecursive(item.elements, itemPath, state);
            if (state.truncated) {
                return;
            }
        }
    }
};

export const validateDatasetElements = (
    elements: readonly NormalizedDicomElement[],
    options: DicomValidationOptions = {}
): {
    diagnostics: DicomDiagnostic[];
    truncated: boolean;
} => {
    const state: ValidationState = {
        diagnostics: [],
        options: resolveOptions(options),
        truncated: false,
    };

    validateElementsRecursive(elements, [], state);
    return {
        diagnostics: state.diagnostics,
        truncated: state.truncated,
    };
};
