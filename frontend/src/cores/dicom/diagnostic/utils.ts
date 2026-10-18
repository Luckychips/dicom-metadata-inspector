import type { DicomDiagnostic, DicomValidationStats } from './types';

export const createValidationStats = (diagnostics: readonly DicomDiagnostic[]): DicomValidationStats => {
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const diagnostic of diagnostics) {
        switch (diagnostic.severity) {
            case 'error':
                errorCount++;
                break;
            case 'warning':
                warningCount++;
                break;
            case 'info':
                infoCount++;
                break;
        }
    }

    return {
        errorCount,
        warningCount,
        infoCount,
        totalCount: diagnostics.length,
    };
};

export const isValidDicomUID = (value: string): boolean => {
    if (value.length === 0 || value.length > 64) {
        return false;
    }

    if (!/^[0-9]+(?:\.[0-9]+)*$/.test(value)) {
        return false;
    }

    const components = value.split('.');
    for (const component of components) {
        if (component.length === 0) {
            return false;
        }

        if (component.length > 1 && component.startsWith('0')) {
            return false;
        }
    }

    return true;
};
