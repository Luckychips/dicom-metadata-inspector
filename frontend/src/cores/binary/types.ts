export type Endianness = 'LE' | 'BE';

export interface BinaryContext {
    view: DataView;
    littleEndian: boolean;
}

export interface ReadResult<T> {
    value: T;
    nextOffset: number;
}

export interface BinaryCursor {
    context: BinaryContext;
    offset: number;
}
