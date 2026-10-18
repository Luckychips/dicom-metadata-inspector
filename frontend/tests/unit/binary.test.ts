import { describe, expect, it } from 'vitest';
import {
    createBinaryContext,
    readUint8,
    readInt8,
    readUint16,
    readInt16,
    readUint32,
    readInt32,
    readFloat32,
    readFloat64,
    readBytes,
    readFileBuffer,
    readFileRange,
} from '@/cores';

describe('Binary Reader', () => {
    it('reads unsigned and signed 8-bit values', () => {
        const context = createBinaryContext(Uint8Array.from([0xff, 0x7f]).buffer);
        expect(readUint8(context, 0)).toEqual({ value: 255, nextOffset: 1 });
        expect(readInt8(context, 0).value).toBe(-1);
        expect(readInt8(context, 1).value).toBe(127);
    });

    it('reads little-endian 16-bit values', () => {
        const context = createBinaryContext(Uint8Array.from([0x34, 0x12]).buffer, 'LE');
        expect(readUint16(context, 0)).toEqual({ value: 0x1234, nextOffset: 2 });
    });

    it('reads big-endian 16-bit values', () => {
        const context = createBinaryContext(Uint8Array.from([0x12, 0x34]).buffer, 'BE');
        expect(readUint16(context, 0).value).toBe(0x1234);
    });

    it('reads signed 16-bit values', () => {
        const context = createBinaryContext(Uint8Array.from([0xfe, 0xff]).buffer);
        expect(readInt16(context, 0).value).toBe(-2);
    });

    it('reads unsigned 32-bit values', () => {
        const context = createBinaryContext(Uint8Array.from([0x78, 0x56, 0x34, 0x12]).buffer);
        expect(readUint32(context, 0).value).toBe(0x12345678);
        expect(readUint32(context, 0).nextOffset).toBe(4);
    });

    it('reads signed 32-bit values', () => {
        const context = createBinaryContext(Uint8Array.from([0xff, 0xff, 0xff, 0xff]).buffer);
        expect(readInt32(context, 0).value).toBe(-1);
    });

    it('reads floating-point values', () => {
        const buffer = new ArrayBuffer(12);
        const view = new DataView(buffer);

        view.setFloat32(0, 1.5, true);
        view.setFloat64(4, Math.PI, true);

        const context = createBinaryContext(buffer);
        expect(readFloat32(context, 0).value).toBeCloseTo(1.5);
        expect(readFloat64(context, 4).value).toBeCloseTo(Math.PI);
    });

    it('reads bytes at an offset', () => {
        const context = createBinaryContext(Uint8Array.from([10, 20, 30, 40, 50]).buffer);
        const result = readBytes(context, 1, 3);
        expect(Array.from(result.value)).toEqual([20, 30, 40]);
        expect(result.nextOffset).toBe(4);
    });

    it('rejects out-of-bounds reads', () => {
        const context = createBinaryContext(new ArrayBuffer(2));
        expect(() => readUint32(context, 0)).toThrow();
        expect(() => readUint16(context, 2)).toThrow();
        expect(() => readBytes(context, 1, 2)).toThrow();
    });

    it('reads a native File into ArrayBuffer', async () => {
        const file = new File([Uint8Array.from([1, 2, 3, 4])], 'binary.bin');
        const buffer = await readFileBuffer(file);
        expect(Array.from(new Uint8Array(buffer))).toEqual([1, 2, 3, 4]);
    });

    it('reads a File range', async () => {
        const file = new File([Uint8Array.from([1, 2, 3, 4, 5])], 'binary.bin');
        const buffer = await readFileRange(file, 1, 3);
        expect(Array.from(new Uint8Array(buffer))).toEqual([2, 3, 4]);
    });

    it('handles an already-aborted File read', async () => {
        const controller = new AbortController();
        controller.abort();

        const file = new File([new Uint8Array(100)], 'cancel.bin');
        await expect(readFileBuffer(file, controller.signal)).rejects.toBeDefined();
    });
});
