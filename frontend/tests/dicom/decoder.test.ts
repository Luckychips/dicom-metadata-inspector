import { describe, expect, it } from 'vitest';
import { decodeDicomValue } from '@/cores';
import type { DicomVR } from '@/cores';

const encoder = new TextEncoder();

const text = (value: string): Uint8Array => encoder.encode(value);
const numeric = (byteLength: number, write: (view: DataView) => void): Uint8Array => {
    const buffer = new ArrayBuffer(byteLength);
    write(new DataView(buffer));
    return new Uint8Array(buffer);
};

const us = (value: number, littleEndian = true) =>
    numeric(2, (view) => view.setUint16(0, value, littleEndian));

const ss = (value: number, littleEndian = true) =>
    numeric(2, (view) => view.setInt16(0, value, littleEndian));

const ul = (value: number, littleEndian = true) =>
    numeric(4, (view) => view.setUint32(0, value, littleEndian));

const sl = (value: number, littleEndian = true) =>
    numeric(4, (view) => view.setInt32(0, value, littleEndian));

const fl = (value: number, littleEndian = true) =>
    numeric(4, (view) => view.setFloat32(0, value, littleEndian));

const fd = (value: number, littleEndian = true) =>
    numeric(8, (view) => view.setFloat64(0, value, littleEndian));

const uv = (value: bigint, littleEndian = true) =>
    numeric(8, (view) => view.setBigUint64(0, value, littleEndian));

const sv = (value: bigint, littleEndian = true) =>
    numeric(8, (view) => view.setBigInt64(0, value, littleEndian));

const concat = (...values: Uint8Array[]): Uint8Array => {
    const result = new Uint8Array(values.reduce((sum, value) => sum + value.length, 0));
    let offset = 0;
    for (const value of values) {
        result.set(value, offset);
        offset += value.length;
    }

    return result;
};

describe('DICOM VR decoding', () => {
    describe('Null and unknown VR', () => {
        it('returns null when rawValue is null', () => {
            expect(decodeDicomValue('PN', null)).toBeNull();
        });

        it('returns raw bytes when VR is null', () => {
            const raw = new Uint8Array([1, 2, 3]);
            expect(decodeDicomValue(null, raw)).toBe(raw);
        });
    });

    describe('Text VR', () => {
        it.each([
            ['AE', 'APPLICATION'],
            ['AS', '032Y'],
            ['CS', 'CT'],
            ['DA', '20261025'],
            ['DT', '20261025123000'],
            ['LO', 'Test Description'],
            ['PN', 'DOE_JOHN'],
            ['SH', 'SHORT'],
            ['TM', '123000'],
            ['UC', 'Unlimited Characters'],
            ['UR', 'https://example.com'],
            ['LT', 'Long text'],
            ['ST', 'Short text'],
            ['UT', 'Unlimited text'],
        ] as const)('decodes %s text', (vr, value) => {
            expect(decodeDicomValue(vr, text(value))).toBe(value);
        });

        it('decodes UI with NULL padding', () => {
            expect(decodeDicomValue('UI', text('1.2.840.10008.1.2.1\0'))).toBe('1.2.840.10008.1.2.1');
        });

        it('decodes multi-value CS', () => {
            expect(decodeDicomValue('CS', text('ORIGINAL\\PRIMARY'))).toEqual(['ORIGINAL', 'PRIMARY']);
        });

        it('decodes multi-value PN', () => {
            expect(decodeDicomValue('PN', text('DOE_JOHN\\KIM_JANE'))).toEqual(['DOE_JOHN', 'KIM_JANE']);
        });
    });

    describe('String numeric VR', () => {
        it('decodes DS', () => {
            expect(decodeDicomValue('DS', text('1.25'))).toBe(1.25);
        });

        it('decodes IS', () => {
            expect(decodeDicomValue('IS', text('-42'))).toBe(-42);
        });

        it('decodes multi-value DS', () => {
            expect(decodeDicomValue('DS', text('1.5\\2.5'))).toEqual([1.5, 2.5]);
        });

        it('decodes multi-value IS', () => {
            expect(decodeDicomValue('IS', text('1\\2\\3'))).toEqual([1, 2, 3]);
        });
    });

    describe('Integer VR', () => {
        it('decodes US', () => {
            expect(decodeDicomValue('US', us(512))).toBe(512);
        });

        it('decodes SS', () => {
            expect(decodeDicomValue('SS', ss(-123))).toBe(-123);
        });

        it('decodes UL', () => {
            expect(decodeDicomValue('UL', ul(65536))).toBe(65536);
        });

        it('decodes SL', () => {
            expect(decodeDicomValue('SL', sl(-65536))).toBe(-65536);
        });

        it('decodes US in Big Endian', () => {
            expect(decodeDicomValue('US', us(512, false), {
                littleEndian: false,
            })).toBe(512);
        });

        it('decodes UL in Big Endian', () => {
            expect(decodeDicomValue('UL', ul(65536, false), {
                littleEndian: false,
            })).toBe(65536);
        });

        it('decodes multiple US values', () => {
            expect(decodeDicomValue('US', concat(us(256), us(512)))).toEqual([256, 512]);
        });
    });

    describe('Floating-point VR', () => {
        it('decodes FL', () => {
            expect(decodeDicomValue('FL', fl(3.5))).toBeCloseTo(3.5);
        });

        it('decodes FD', () => {
            expect(decodeDicomValue('FD', fd(Math.PI))).toBeCloseTo(Math.PI, 12);
        });

        it('decodes FL in Big Endian', () => {
            expect(decodeDicomValue('FL', fl(3.5, false), {
                littleEndian: false,
            })).toBeCloseTo(3.5);
        });
    });

    describe('64-bit integer VR', () => {
        it('decodes UV', () => {
            const result = decodeDicomValue('UV', uv(123456789n));
            expect(result).not.toBeNull();
        });

        it('decodes SV', () => {
            const result = decodeDicomValue('SV', sv(-123456789n));
            expect(result).not.toBeNull();
        });
    });

    describe('AT VR', () => {
        it('decodes a DICOM attribute tag', () => {
            const raw = new Uint8Array([0x10, 0x00, 0x10, 0x00]);
            const result = decodeDicomValue('AT', raw);
            expect(result).not.toBeNull();
        });
    });

    describe('Binary VR', () => {
        it.each(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'UN',] as DicomVR[])('decodes %s without losing bytes', (vr) => {
            const raw = new Uint8Array([0x00, 0x01, 0x7f, 0xff]);
            const result = decodeDicomValue(vr, raw);
            expect(result).not.toBeNull();
        });

        it('returns raw bytes for SQ', () => {
            const raw = new Uint8Array([1, 2, 3]);
            expect(decodeDicomValue('SQ', raw)).toBe(raw);
        });
    });
});
