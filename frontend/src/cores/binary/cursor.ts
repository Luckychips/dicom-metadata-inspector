import type {
    BinaryContext,
    BinaryCursor,
    ReadResult,
} from './types';
import { assertBounds, readUint16, readUint32 } from './reader';

export const createCursor = (
    context: BinaryContext,
    offset = 0
): BinaryCursor => {
    assertBounds(context, offset, 0);

    return { context, offset };
};

export const seek = (
    cursor: BinaryCursor,
    offset: number
): BinaryCursor => {
    assertBounds(cursor.context, offset, 0);

    return {
        ...cursor,
        offset,
    };
};

export const skip = (
    cursor: BinaryCursor,
    length: number
): BinaryCursor => {
    assertBounds(cursor.context, cursor.offset, length);

    return {
        ...cursor,
        offset: cursor.offset + length,
    };
};

export const remaining = (
    cursor: BinaryCursor
): number =>
    cursor.context.view.byteLength - cursor.offset;

export const readFromCursor = <T>(
    cursor: BinaryCursor,
    reader: (
        context: BinaryContext,
        offset: number
    ) => ReadResult<T>
): {
    value: T;
    cursor: BinaryCursor;
} => {
    const result = reader(
        cursor.context,
        cursor.offset
    );

    return {
        value: result.value,
        cursor: seek(cursor, result.nextOffset),
    };
};

// 자주 사용하는 읽기 함수
export const readCursorUint16 = (
    cursor: BinaryCursor
) => readFromCursor(cursor, readUint16);

export const readCursorUint32 = (
    cursor: BinaryCursor
) => readFromCursor(cursor, readUint32);
