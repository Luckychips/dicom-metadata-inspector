import type { DicomFileEntry } from '@/cores/file/types';
import type {
    BinaryContext,
    Endianness,
} from './types';
import { readAscii } from '@/cores';
import { createBinaryContext, readUint16 } from '@/cores';

export interface DicomHeaderInfo {
    prefix: string | null;
    isPart10Candidate: boolean;
    firstTag: {
        group: number;
        element: number;
    } | null;
}

export const readFileBuffer = async (
    file: File,
    signal?: AbortSignal
): Promise<ArrayBuffer> => {
    signal?.throwIfAborted();

    const buffer = await file.arrayBuffer();

    signal?.throwIfAborted();

    return buffer;
};

export const readFileRange = async (
    file: File,
    offset: number,
    length: number,
    signal?: AbortSignal
): Promise<ArrayBuffer> => {
    if (
        !Number.isSafeInteger(offset) ||
        !Number.isSafeInteger(length) ||
        offset < 0 ||
        length < 0 ||
        offset > file.size ||
        length > file.size - offset
    ) {
        throw new RangeError('Invalid file range');
    }

    signal?.throwIfAborted();

    const buffer = await file.slice(offset, offset + length).arrayBuffer();
    signal?.throwIfAborted();

    return buffer;
};

export const createFileBinaryContext = async (
    file: File,
    endianness: Endianness = 'LE',
    signal?: AbortSignal
): Promise<BinaryContext> => {
    const buffer = await readFileBuffer(file, signal);
    return createBinaryContext(buffer, endianness);
};

export const inspectFileHeader = async (
    entry: DicomFileEntry,
    signal?: AbortSignal
): Promise<DicomHeaderInfo> => {
    const { file } = entry;

    if (file.size < 132) {
        return {
            prefix: null,
            isPart10Candidate: false,
            firstTag: null,
        };
    }

    const buffer = await readFileRange(
        file,
        0,
        Math.min(file.size, 136),
        signal
    );

    const context = createBinaryContext(buffer, 'LE');

    const prefix = readAscii(
        context,
        128,
        4
    ).value;

    if (prefix !== 'DICM') {
        return {
            prefix,
            isPart10Candidate: false,
            firstTag: null,
        };
    }

    if (file.size < 136) {
        return {
            prefix,
            isPart10Candidate: true,
            firstTag: null,
        };
    }

    return {
        prefix,
        isPart10Candidate: true,
        firstTag: {
            group: readUint16(context, 132).value,
            element: readUint16(context, 134).value,
        },
    };
};
