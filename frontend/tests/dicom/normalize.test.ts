import { describe, expect, it } from 'vitest';
import { normalizeDicomFile, parseDicomBuffer } from '@/cores';
import {
    createDicomFixture,
    explicitElement,
    explicitText,
    implicitText,
    le16,
} from '../fixtures/dicom';

const parseAndNormalize = (buffer: ArrayBuffer) => {
    const parsed = parseDicomBuffer(buffer);
    return normalizeDicomFile(parsed);
};

describe('DICOM Metadata Normalization', () => {
    describe('Basic normalization', () => {
        it('normalizes a valid DICOM file', () => {
            const result = parseAndNormalize(createDicomFixture());
            expect(result).toBeDefined();
        });

        it('produces deterministic results', () => {
            const buffer = createDicomFixture();
            const first = parseAndNormalize(buffer);
            const second = parseAndNormalize(buffer);
            expect(first).toEqual(second);
        });

        it('preserves distinct patient metadata', () => {
            const first = parseAndNormalize(createDicomFixture({ patientName: 'FIRST_PATIENT', patientID: 'FIRST001' }));
            const second = parseAndNormalize(createDicomFixture({ patientName: 'SECOND_PATIENT', patientID: 'SECOND002' }));
            expect(first).not.toEqual(second);
        });
    });

    describe('VR normalization', () => {
        it('normalizes a text element', () => {
            const fixture = createDicomFixture({ additionalElements: [explicitText(0x0008, 0x1030, 'LO', 'Brain CT')] });
            const result = parseAndNormalize(fixture);
            expect(result).toBeDefined();
        });

        it('normalizes a numeric element', () => {
            const fixture = createDicomFixture({ additionalElements: [explicitElement(0x0028, 0x0010, 'US', le16(512))] });
            const result = parseAndNormalize(fixture);
            expect(result).toBeDefined();
        });

        it('normalizes multi-value DS', () => {
            const fixture = createDicomFixture({ additionalElements: [explicitText(0x0028, 0x0030, 'DS', '0.5\\0.75')] });
            const result = parseAndNormalize(fixture);
            expect(result).toBeDefined();
        });
    });

    describe('Dictionary integration', () => {
        it('handles an unknown public tag', () => {
            const fixture = createDicomFixture({ additionalElements: [explicitText(0x0040, 0x9999, 'LO', 'UNKNOWN')] });
            const result = parseAndNormalize(fixture);
            expect(result).toBeDefined();
        });

        it('handles a private tag', () => {
            const fixture = createDicomFixture({ additionalElements: [explicitText(0x0011, 0x1010, 'LO', 'PRIVATE')] });
            const result = parseAndNormalize(fixture);
            expect(result).toBeDefined();
        });
    });

    describe('Implicit VR', () => {
        it('normalizes an Implicit VR dataset', () => {
            const fixture = createDicomFixture({ transferSyntaxUID: '1.2.840.10008.1.2', additionalElements: [implicitText(0x0008, 0x1030, 'LO', 'Implicit Study')] });
            const result = parseAndNormalize(fixture);
            expect(result).toBeDefined();
        });
    });

    describe('Input immutability', () => {
        it('does not mutate the input ArrayBuffer', () => {
            const buffer = createDicomFixture();
            const before = Uint8Array.from(new Uint8Array(buffer));
            parseAndNormalize(buffer);
            expect(new Uint8Array(buffer)).toEqual(before);
        });
    });
});
