import { readBytes } from './_';
import type { BinaryContext, ReadResult } from './types';

interface StringReadOptions {
    encoding?: string;
    fatal?: boolean;
    trimPadding?: boolean;
}

export const decodeBytes = (bytes: Uint8Array, options: StringReadOptions = {}): string => {
    const { encoding = 'utf-8', fatal = true, trimPadding = false } = options;
    const decoder = new TextDecoder(encoding, { fatal });
    const value = decoder.decode(bytes);
    return trimPadding ? value.replace(/[\u0000 ]+$/g, "") : value;
};

export const readAscii = (
    context: BinaryContext,
    offset: number,
    length: number
): ReadResult<string> => {
    return readString(context, offset, length, { encoding: 'ascii', fatal: true });
};

export const readString = (context: BinaryContext, offset: number, length: number, options: StringReadOptions = {}): ReadResult<string> => {
    const result = readBytes(context, offset, length);
    return {
        value: decodeBytes(result.value, options),
        nextOffset: result.nextOffset,
    };
};
