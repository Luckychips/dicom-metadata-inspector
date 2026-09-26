import type { DicomFileType } from './types';

const DICM_OFFSET = 128;
const DICM_LENGTH = 4;
const MINIMUM_SIZE = DICM_OFFSET + DICM_LENGTH;

const DICM_SIGNATURE = new Uint8Array([
    0x44, // D
    0x49, // I
    0x43, // C
    0x4d, // M
]);

export const detectDicomFile = async (file: File, signal?: AbortSignal): Promise<DicomFileType> => {
    signal?.throwIfAborted();

    if (file.size === 0) {
        return 'invalid';
    }

    if (file.size < MINIMUM_SIZE) {
        return 'unknown';
    }

    const buffer = await file.slice(DICM_OFFSET, MINIMUM_SIZE).arrayBuffer();

    signal?.throwIfAborted();

    const bytes = new Uint8Array(buffer);
    const hasDicmPrefix = DICM_SIGNATURE.every(
        (value, index) => bytes[index] === value
    );

    return hasDicmPrefix ? 'part10-candidate' : 'unknown';
};
