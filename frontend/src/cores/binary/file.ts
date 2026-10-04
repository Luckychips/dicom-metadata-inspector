import { createBinaryContext } from '@/cores';
import type { BinaryContext, Endianness } from './types';

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
