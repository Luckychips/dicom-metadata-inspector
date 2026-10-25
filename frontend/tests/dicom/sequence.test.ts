import { describe, expect, it } from 'vitest';
import { parseDicomBuffer } from '@/cores';
import {
    createDicomFixture,
    explicitText,
    sequenceItem,
    definedLengthSequence,
    undefinedLengthSequence,
} from '../fixtures/dicom';

const createPatientName = (name: string) => {
    return explicitText(0x0010, 0x0010, 'PN', name);
}

const createSequence = (items: Uint8Array[], undefinedLength = false) => {
    return undefinedLength ? undefinedLengthSequence(0x0008, 0x1111, items) : definedLengthSequence(0x0008, 0x1111, items);
}

const parseWithSequence = (sequence: Uint8Array) => {
    return parseDicomBuffer(createDicomFixture({additionalElements: [sequence]}));
}

const getSequence = (parsed: ReturnType<typeof parseDicomBuffer>) => {
    return parsed.dataset.elements.find((element) => element.tag.group === 0x0008 && element.tag.element === 0x1111);
}

describe('DICOM Sequence parsing', () => {
    describe('Defined-length Sequence', () => {
        it('parses a sequence with one item', () => {
            const sq = createSequence([sequenceItem([createPatientName('DOE_JOHN')])]);
            const parsed = parseWithSequence(sq);
            const result = getSequence(parsed);

            expect(result?.vr).toBe('SQ');
            expect(result?.undefinedLength).toBe(false);
            expect(result?.items).toHaveLength(1);
            expect(result?.items?.[0].dataset.elements[0].tag).toEqual({ group: 0x0010, element: 0x0010 });
        });

        it('parses multiple items', () => {
            const sq = createSequence([sequenceItem([createPatientName('FIRST')]), sequenceItem([createPatientName('SECOND')])]);
            const parsed = parseWithSequence(sq);
            const result = getSequence(parsed);

            expect(result?.items).toHaveLength(2);
        });

        it('parses an empty sequence', () => {
            const parsed = parseWithSequence(createSequence([]));
            const result = getSequence(parsed);

            expect(result?.vr).toBe('SQ');
            expect(result?.items).toEqual([]);
            expect(result?.valueLength).toBe(0);
        });
    });

    describe('Undefined-length Sequence', () => {
        it('parses a sequence with undefined length', () => {
            const sq = createSequence([sequenceItem([createPatientName('DOE_JANE')])], true);
            const parsed = parseWithSequence(sq);
            const result = getSequence(parsed);

            expect(result?.vr).toBe('SQ');
            expect(result?.undefinedLength).toBe(true);
            expect(result?.items).toHaveLength(1);
            expect(result?.endOffset).toBeGreaterThan(result!.valueOffset);
        });

        it('parses an undefined-length item', () => {
            const sq = createSequence([sequenceItem([createPatientName('DOE_JOHN')], true)], true);
            const parsed = parseWithSequence(sq);
            const result = getSequence(parsed);
            const firstItem = result?.items?.[0];

            expect(firstItem?.undefinedLength).toBe(true);
            expect(firstItem?.dataset.elements).toHaveLength(1);
        });

        it('parses an empty undefined-length sequence', () => {
            const parsed = parseWithSequence(createSequence([], true));

            expect(getSequence(parsed)?.items).toEqual([]);
        });
    });

    describe('Nested Sequence', () => {
        it('parses nested SQ elements', () => {
            const inner = definedLengthSequence(
                0x0008,
                0x1150,
                [sequenceItem([createPatientName('NESTED_PATIENT')])],
            );
            const outer = createSequence([sequenceItem([inner])]);
            const parsed = parseWithSequence(outer);
            const result = getSequence(parsed);
            const nested = result?.items?.[0].dataset.elements[0];

            expect(nested?.vr).toBe('SQ');
            expect(nested?.items).toHaveLength(1);
            expect(nested?.items?.[0].dataset.elements[0].tag).toEqual({ group: 0x0010, element: 0x0010 });
        });
    });

    describe('Dataset integration', () => {
        it('parses elements following a sequence', () => {
            const sq = createSequence([sequenceItem([createPatientName('TEST')])]);
            const afterSequence = explicitText(0x0020, 0x0011, 'IS', '5');
            const parsed = parseDicomBuffer(createDicomFixture({ additionalElements: [sq, afterSequence] }));
            const elements = parsed.dataset.elements;
            const sqIndex = elements.findIndex((element) => element.tag.group === 0x0008 && element.tag.element === 0x1111);

            expect(sqIndex).toBeGreaterThanOrEqual(0);
            expect(elements[sqIndex + 1].tag).toEqual({ group: 0x0020, element: 0x0011 });
        });

        it('preserves sequence and item offsets', () => {
            const sq = createSequence([sequenceItem([createPatientName('TEST')])]);
            const parsed = parseWithSequence(sq);
            const result = getSequence(parsed);
            const firstItem = result?.items?.[0];

            expect(result).toBeDefined();
            expect(firstItem).toBeDefined();
            expect(result!.valueOffset).toBeGreaterThan(result!.offset);
            expect(firstItem!.valueOffset).toBeGreaterThan(firstItem!.offset);
            expect(firstItem!.endOffset).toBeGreaterThanOrEqual(firstItem!.valueOffset);
        });
    });
});
