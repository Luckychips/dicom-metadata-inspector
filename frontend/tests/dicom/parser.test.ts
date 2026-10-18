import { describe, expect, it } from 'vitest';
import {
    createBinaryContext,
    isDicomParseError,
    parseDicomBuffer,
    parseDicomFile,
    parseFileMeta,
    parseElementHeader,
} from '@/cores';
import {
    createDicomFixture,
    createDicomTestFile,
    explicitText,
} from '../fixtures/dicom';

describe('DICOM Parsing', () => {
    describe('Part 10', () => {
        it('parses a valid DICOM Part 10 buffer', () => {
            const buffer = createDicomFixture();

            const result = parseDicomBuffer(buffer);

            expect(result.isPart10).toBe(true);
            expect(result.fileMeta.elements.length)
                .toBeGreaterThan(0);
            expect(result.dataset.elements.length)
                .toBeGreaterThan(0);
        });

        it('parses a browser File', async () => {
            const file = createDicomTestFile();

            const result = await parseDicomFile(file);

            expect(result.isPart10).toBe(true);
        });

        it('rejects a missing DICM prefix', () => {
            const buffer = new ArrayBuffer(256);

            expect(() => parseDicomBuffer(buffer))
                .toThrow();
        });

        it('rejects a truncated file', () => {
            const buffer = new ArrayBuffer(64);

            expect(() => parseDicomBuffer(buffer))
                .toThrow();
        });

        it('recognizes structured parser errors', () => {
            try {
                parseDicomBuffer(new ArrayBuffer(64));
                expect.fail('Expected a parse error');
            } catch (error) {
                expect(isDicomParseError(error)).toBe(true);

                if (isDicomParseError(error)) {
                    expect(error.name)
                        .toBe('DicomParseError');

                    expect(error.code)
                        .toBeTruthy();
                }
            }
        });
    });

    describe('File Meta Information', () => {
        it('extracts Transfer Syntax UID', () => {
            const meta = parseFileMeta(
                createDicomFixture()
            );

            expect(meta.transferSyntaxUID)
                .toBe('1.2.840.10008.1.2.1');
        });

        it('returns the Dataset starting offset', () => {
            const buffer = createDicomFixture();
            const meta = parseFileMeta(buffer);

            expect(meta.datasetOffset)
                .toBeGreaterThan(132);

            expect(meta.datasetOffset)
                .toBeLessThan(buffer.byteLength);
        });

        it('parses File Meta with Explicit VR Little Endian', () => {
            const meta = parseFileMeta(
                createDicomFixture({
                    transferSyntaxUID:
                        '1.2.840.10008.1.2',
                })
            );

            expect(meta.transferSyntaxUID)
                .toBe('1.2.840.10008.1.2');

            expect(meta.elements.some(element =>
                element.tag.group === 0x0002 &&
                element.tag.element === 0x0010
            )).toBe(true);
        });
    });

    describe('Data Element Header', () => {
        it('parses a short Explicit VR header', () => {
            const bytes = explicitText(
                0x0010,
                0x0010,
                'PN',
                'TEST^PATIENT'
            );

            const context = createBinaryContext(
                bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength
                ) as ArrayBuffer
            );

            const header = parseElementHeader(
                context,
                0,
                { explicitVR: true }
            );

            expect(header.tag.group).toBe(0x0010);
            expect(header.tag.element).toBe(0x0010);
            expect(header.vr).toBe('PN');
            expect(header.headerLength).toBe(8);
            expect(header.valueOffset).toBe(8);
            expect(header.undefinedLength).toBe(false);
        });

        it('parses consecutive Dataset elements', () => {
            const result = parseDicomBuffer(
                createDicomFixture()
            );

            const tags = result.dataset.elements.map(
                element =>
                    element.tag.group.toString(16)
                        .padStart(4, '0') +
                    element.tag.element.toString(16)
                        .padStart(4, '0')
            );

            expect(tags).toContain('00100010');
            expect(tags).toContain('00100020');
            expect(tags).toContain('00080060');
        });

        it('preserves raw element values', () => {
            const result = parseDicomBuffer(
                createDicomFixture({
                    patientID: 'ABC123',
                })
            );

            const patientID = result.dataset.elements.find(
                element =>
                    element.tag.group === 0x0010 &&
                    element.tag.element === 0x0020
            );

            expect(patientID).toBeDefined();

            expect(
                new TextDecoder().decode(
                    patientID?.rawValue ?? new Uint8Array()
                ).trim()
            ).toBe('ABC123');
        });
    });

    describe('Dataset options', () => {
        it('supports Implicit VR Little Endian', () => {
            const result = parseDicomBuffer(
                createDicomFixture({
                    transferSyntaxUID:
                        '1.2.840.10008.1.2',
                })
            );

            expect(result.transferSyntax.explicitVR)
                .toBe(false);

            expect(result.dataset.elements.some(
                element =>
                    element.tag.group === 0x0010 &&
                    element.tag.element === 0x0010
            )).toBe(true);
        });

        it('supports an element limit', () => {
            const buffer = createDicomFixture();

            expect(() =>
                parseDicomBuffer(buffer, {
                    maxElements: 2,
                })
            ).toThrow('Maximum DICOM element count exceeded: 2');
        });

        it('detects a truncated element value', () => {
            const original = createDicomFixture();

            const truncated = original.slice(
                0,
                original.byteLength - 2
            );

            expect(() => parseDicomBuffer(truncated))
                .toThrow();
        });
    });
});
