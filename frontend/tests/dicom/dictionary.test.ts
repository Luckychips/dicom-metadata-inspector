import { describe, expect, it } from 'vitest';
import {
    createTagKey,
    isPrivateTag,
    getDictionaryEntry,
    getDictionaryEntryByTag,
    getDictionaryVR,
    parseDicomBuffer,
    resolveElementVR,
} from '@/cores';
import { createDicomFixture, explicitText } from '../fixtures/dicom';

describe('DICOM Data Dictionary', () => {
    describe('Tag key', () => {
        it('creates an uppercase 8-character key', () => {
            expect(createTagKey(0x0010, 0x0010)).toBe('00100010');
            expect(createTagKey(0x0008, 0x103e)).toBe('0008103E');
            expect(createTagKey(0x7fe0, 0x0010)).toBe('7FE00010');
        });
    });

    describe('Private Tag', () => {
        it('identifies odd groups as private', () => {
            expect(isPrivateTag(0x0011)).toBe(true);
            expect(isPrivateTag(0x0009)).toBe(true);
        });

        it('identifies even groups as non-private', () => {
            expect(isPrivateTag(0x0010)).toBe(false);
            expect(isPrivateTag(0x0008)).toBe(false);
        });
    });

    describe('Standard dictionary lookup', () => {
        it.each([
            [0x0010, 0x0010, 'PatientName', 'PN', '1'],
            [0x0010, 0x0020, 'PatientID', 'LO', '1'],
            [0x0008, 0x0060, 'Modality', 'CS', '1'],
            [0x0020, 0x000d, 'StudyInstanceUID', 'UI', '1'],
            [0x0020, 0x000e, 'SeriesInstanceUID', 'UI', '1'],
            [0x0008, 0x0018, 'SOPInstanceUID', 'UI', '1'],
            [0x0028, 0x0010, 'Rows', 'US', '1'],
            [0x0028, 0x0011, 'Columns', 'US', '1'],
            [0x0008, 0x1115, 'ReferencedSeriesSequence', 'SQ', '1'],
        ] as const)(
            'resolves (%s,%s)',
            (group, element, keyword, vr, vm) => {
                const entry = getDictionaryEntry(group, element);

                expect(entry).not.toBeNull();
                expect(entry?.keyword).toBe(keyword);
                expect(entry?.vr).toEqual([vr]);
                expect(entry?.vm).toBe(vm);
            },
        );

        it('resolves the exact Patient Name entry', () => {
            expect(getDictionaryEntry(0x0010, 0x0010))
                .toEqual({
                    name: "Patient's Name",
                    keyword: 'PatientName',
                    vr: ['PN'],
                    vm: '1',
                });
        });

        it('supports variable VM', () => {
            expect(getDictionaryEntry(0x0008, 0x0008)?.vm).toBe('2-n');
            expect(getDictionaryEntry(0x0028, 0x1050)?.vm).toBe('1-n');
        });

        it('supports multiple VR candidates', () => {
            const entry = getDictionaryEntry(0x7fe0, 0x0010);

            expect(entry?.keyword).toBe('PixelData');
            expect(entry?.vr).toEqual(['OB', 'OW']);
        });
    });

    describe('Unknown tags', () => {
        it('returns null for an unknown public tag', () => {
            expect(getDictionaryEntry(0x0020, 0xffff)).toBeNull();
        });

        it('returns null for an unregistered private tag', () => {
            expect(getDictionaryEntry(0x0011, 0x1010)).toBeNull();
        });
    });

    describe('Lookup by DicomTag', () => {
        it('resolves a tag object', () => {
            const entry = getDictionaryEntryByTag({ group: 0x0008, element: 0x0060 });

            expect(entry?.keyword).toBe('Modality');
            expect(entry?.vr).toEqual(['CS']);
        });

        it('returns null for an unknown tag object', () => {
            expect(getDictionaryEntryByTag({
                group: 0x0011,
                element: 0x1010,
            })).toBeNull();
        });
    });

    describe('Dictionary VR', () => {
        it('returns a single VR', () => {
            expect(getDictionaryVR(0x0010, 0x0010)).toBe('PN');
            expect(getDictionaryVR(0x0028, 0x0010)).toBe('US');
        });

        it('returns null for multiple VR candidates', () => {
            expect(getDictionaryVR(0x7fe0, 0x0010)).toBeNull();
        });

        it('returns null for unknown tags', () => {
            expect(getDictionaryVR(0x0011, 0x1010)).toBeNull();
        });
    });

    describe('VR resolution', () => {
        it('prioritizes Explicit VR', () => {
            const result = resolveElementVR({ group: 0x0010, element: 0x0010 }, 'LO');

            expect(result.vr).toBe('LO');
            expect(result.source).toBe('explicit');
            expect(result.dictionaryEntry?.keyword).toBe('PatientName');
        });

        it('resolves Implicit VR from dictionary', () => {
            const result = resolveElementVR({ group: 0x0010, element: 0x0010 }, null);

            expect(result.vr).toBe('PN');
            expect(result.source).toBe('dictionary');
        });

        it('does not guess a VR when multiple candidates exist', () => {
            const result = resolveElementVR({ group: 0x7fe0, element: 0x0010 }, null);

            expect(result.vr).toBeNull();
            expect(result.source).toBe('unknown');
            expect(result.dictionaryEntry?.vr).toEqual(['OB', 'OW']);
        });

        it('handles an unknown tag', () => {
            const result = resolveElementVR({ group: 0x0011, element: 0x1010 }, null);

            expect(result.vr).toBeNull();
            expect(result.source).toBe('unknown');
            expect(result.dictionaryEntry).toBeNull();
        });

        it('preserves Explicit VR for an unknown tag', () => {
            const result = resolveElementVR({ group: 0x0011, element: 0x1010 }, 'LO');

            expect(result.vr).toBe('LO');
            expect(result.source).toBe('explicit');
            expect(result.dictionaryEntry).toBeNull();
        });
    });

    describe('Parser integration', () => {
        it('looks up a parsed Patient Name tag', () => {
            const parsed = parseDicomBuffer(createDicomFixture());
            const element = parsed.dataset.elements.find(({ tag }) => tag.group === 0x0010 && tag.element === 0x0010);

            expect(element).toBeDefined();

            const entry = getDictionaryEntryByTag(element!.tag);

            expect(entry?.keyword).toBe('PatientName');
            expect(entry?.vr).toEqual(['PN']);
        });

        it('looks up an additional Study Description tag', () => {
            const parsed = parseDicomBuffer(
                createDicomFixture({ additionalElements: [explicitText(0x0008, 0x1030, 'LO', 'Brain CT Study')] }),
            );
            const element = parsed.dataset.elements.find(({ tag }) => tag.group === 0x0008 && tag.element === 0x1030);

            expect(element).toBeDefined();

            const entry = getDictionaryEntryByTag(element!.tag);

            expect(entry?.keyword).toBe('StudyDescription');
            expect(entry?.vr).toEqual(['LO']);
        });
    });
});
