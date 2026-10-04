export type DicomParseErrorCode = | 'INVALID_PART10' | 'INVALID_PREFIX' | 'INVALID_VR' | 'INVALID_LENGTH'
    | 'OUT_OF_BOUNDS'
    | 'MISSING_TRANSFER_SYNTAX'
    | 'UNSUPPORTED_TRANSFER_SYNTAX'
    | 'UNSUPPORTED_UNDEFINED_LENGTH'
    | 'MAX_ELEMENTS_EXCEEDED';

export interface DicomParseError {
    name: 'DicomParseError';
    code: DicomParseErrorCode;
    message: string;
    offset?: number;
}

export const createDicomParseError = (
    code: DicomParseErrorCode,
    message: string,
    offset?: number
): DicomParseError => ({
    name: 'DicomParseError',
    code,
    message,
    offset,
});

export const isDicomParseError = (
    value: unknown
): value is DicomParseError => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const error = value as Partial<DicomParseError>;

    return (error.name === 'DicomParseError' && typeof error.code === 'string' && typeof error.message === 'string');
};
