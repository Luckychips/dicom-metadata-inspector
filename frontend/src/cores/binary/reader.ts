import type { BinaryContext, Endianness, ReadResult } from './types';

const readNumber = <T>(
    context: BinaryContext,
    offset: number,
    length: number,
    decoder: (view: DataView, offset: number, littleEndian: boolean) => T
): ReadResult<T> => {
    assertBounds(context, offset, length);
    return {
        value: decoder(context.view, offset, context.littleEndian),
        nextOffset: offset + length,
    };
};

export const assertBounds = (context: BinaryContext, offset: number, length: number): void => {
    const size = context.view.byteLength;
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) ||
        offset < 0 ||
        length < 0 ||
        offset > size ||
        length > size - offset) {
        throw new RangeError(`Invalid binary range: offset=${offset}, ` + `length=${length}, size=${size}`);
    }
};

export const createBinaryContext = (buffer: ArrayBuffer, endianness: Endianness = 'LE'): BinaryContext => ({
    view: new DataView(buffer),
    littleEndian: endianness === 'LE',
});

export const readUint8 = (context: BinaryContext, offset: number): ReadResult<number> => {
    return readNumber(context, offset, 1, (view, pos) => view.getUint8(pos));
}

export const readInt8 = (context: BinaryContext, offset: number): ReadResult<number> => {
    return readNumber(context, offset, 1, (view, pos) => view.getInt8(pos));
}

export const readUint16 = (context: BinaryContext, offset: number): ReadResult<number> => {
    return readNumber(context, offset, 2, (view, pos, le) => view.getUint16(pos, le));
}

export const readInt16 = (context: BinaryContext, offset: number): ReadResult<number> => {
    return readNumber(context, offset, 2, (view, pos, le) => view.getInt16(pos, le));
}

export const readUint32 = (context: BinaryContext, offset: number): ReadResult<number> => {
    return readNumber(context, offset, 4, (view, pos, le) => view.getUint32(pos, le));
}

export const readInt32 = (context: BinaryContext, offset: number): ReadResult<number> => {
    return readNumber(context, offset, 4, (view, pos, le) => view.getInt32(pos, le));
}

export const readUint64 = (context: BinaryContext, offset: number): ReadResult<bigint> => {
    return readNumber(context, offset, 8, (view, pos, le) => view.getBigUint64(pos, le));
}

export const readInt64 = (context: BinaryContext, offset: number): ReadResult<bigint> => {
    return readNumber(context, offset, 8, (view, pos, le) => view.getBigInt64(pos, le));
}

export const readFloat32 = (context: BinaryContext, offset: number): ReadResult<number> => {
    return readNumber(context, offset, 4, (view, pos, le) => view.getFloat32(pos, le));
}

export const readFloat64 = (context: BinaryContext, offset: number): ReadResult<number> => {
    return readNumber(context, offset, 8, (view, pos, le) => view.getFloat64(pos, le));
}

export const readBytes = (context: BinaryContext, offset: number, length: number): ReadResult<Uint8Array> => {
    assertBounds(context, offset, length);
    const view = context.view;
    return {
        value: new Uint8Array(view.buffer, view.byteOffset + offset, length),
        nextOffset: offset + length,
    };
};
