import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeDicomFile, parseDicomBuffer, validateDicomFile } from '@/cores';
import type { NormalizedDicomFile } from '@/cores';
import { createDicomFixture, explicitText } from '../fixtures/dicom';
import type { DicomFixtureOptions } from '../fixtures/dicom';

const uid = (value: number): string => `1.2.826.0.1.3680043.10.1000.${value}`;
const createNormalizedFile = (options: DicomFixtureOptions = {}): NormalizedDicomFile => {
    const buffer = createDicomFixture(options);
    const parsed = parseDicomBuffer(buffer);
    return normalizeDicomFile(parsed);
};

describe('DICOM Validation', () => {
    let file: NormalizedDicomFile;

    beforeEach(() => {
        file = createNormalizedFile({
            studyInstanceUID: uid(1),
            seriesInstanceUID: uid(10),
            sopInstanceUID: uid(101),
            patientName: 'ALPHA_PATIENT',
            patientID: 'PAT001',
            modality: 'CT',
            additionalElements: [explicitText(0x0008, 0x1030, 'LO', 'Brain CT')],
        });
    });

    describe('Validation result', () => {
        it('returns the expected result structure', () => {
            const result = validateDicomFile(file);
            expect(result).toEqual({
                valid: expect.any(Boolean),
                diagnostics: expect.any(Array),
                stats: expect.any(Object),
                truncated: expect.any(Boolean),
            });
        });

        it('marks a file valid when no errors exist', () => {
            const result = validateDicomFile(file);
            expect(result.valid).toBe(result.stats.errorCount === 0);
        });

        it('returns diagnostics as an array', () => {
            const result = validateDicomFile(file);
            expect(Array.isArray(result.diagnostics)).toBe(true);
        });

        it('returns a non-negative error count', () => {
            const result = validateDicomFile(file);
            expect(result.stats.errorCount).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Required UIDs', () => {
        it('does not report missing UID errors for populated UIDs', () => {
            const result = validateDicomFile(file);
            const missingUIDCodes = ['MISSING_STUDY_INSTANCE_UID', 'MISSING_SERIES_INSTANCE_UID', 'MISSING_SOP_INSTANCE_UID'];
            expect(result.diagnostics.filter(diagnostic => missingUIDCodes.includes(diagnostic.code))).toHaveLength(0);
        });

        it('reports a missing Study Instance UID', () => {
            const invalidFile: NormalizedDicomFile = {
                ...file,
                summary: {
                    ...file.summary,
                    studyInstanceUID: '',
                },
            };

            const result = validateDicomFile(invalidFile);
            expect(result.diagnostics.some(diagnostic => diagnostic.code === 'MISSING_STUDY_INSTANCE_UID')).toBe(true);
        });

        it('reports a missing Series Instance UID', () => {
            const invalidFile: NormalizedDicomFile = {
                ...file,
                summary: {
                    ...file.summary,
                    seriesInstanceUID: '',
                },
            };

            const result = validateDicomFile(invalidFile);
            expect(result.diagnostics.some(diagnostic => diagnostic.code === 'MISSING_SERIES_INSTANCE_UID')).toBe(true);
        });

        it('reports a missing SOP Instance UID', () => {
            const invalidFile: NormalizedDicomFile = {
                ...file,
                summary: {
                    ...file.summary,
                    sopInstanceUID: '',
                },
            };

            const result = validateDicomFile(invalidFile);
            expect(result.diagnostics.some(diagnostic => diagnostic.code === 'MISSING_SOP_INSTANCE_UID')).toBe(true);
        });

        it('reports all three missing UIDs independently', () => {
            const invalidFile: NormalizedDicomFile = {
                ...file,
                summary: {
                    ...file.summary,
                    studyInstanceUID: '',
                    seriesInstanceUID: '',
                    sopInstanceUID: '',
                },
            };
            const result = validateDicomFile(invalidFile);
            const codes = result.diagnostics.map(diagnostic => diagnostic.code);
            expect(codes).toContain('MISSING_STUDY_INSTANCE_UID');
            expect(codes).toContain('MISSING_SERIES_INSTANCE_UID');
            expect(codes).toContain('MISSING_SOP_INSTANCE_UID');
        });
    });

    describe('Character set validation', () => {
        it('does not report unsupported character set for supported encoding', () => {
            const result = validateDicomFile(file);
            expect(result.diagnostics.some(diagnostic => diagnostic.code === 'UNSUPPORTED_CHARACTER_SET')).toBe(false);
        });

        it('reports an unsupported character set as a warning', () => {
            const invalidFile: NormalizedDicomFile = {
                ...file,
                characterSet: {
                    ...file.characterSet,
                    supported: false,
                    values: ['UNKNOWN_CHARSET'],
                },
            };
            const result = validateDicomFile(invalidFile);
            expect(result.diagnostics).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        code: 'UNSUPPORTED_CHARACTER_SET',
                        severity: 'warning',
                        message: 'Unsupported Specific Character Set: UNKNOWN_CHARSET',
                    }),
                ]),
            );
        });

        it('uses unknown when the unsupported character set has no values', () => {
            const invalidFile: NormalizedDicomFile = {
                ...file,
                characterSet: {
                    ...file.characterSet,
                    supported: false,
                    values: [],
                },
            };

            const result = validateDicomFile(invalidFile);
            expect(result.diagnostics).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        code: 'UNSUPPORTED_CHARACTER_SET',
                        message: 'Unsupported Specific Character Set: unknown',
                    }),
                ]),
            );
        });
    });

    describe('Validation statistics', () => {
        it('keeps valid consistent with errorCount', () => {
            const result = validateDicomFile(file);
            expect(result.valid).toBe(result.stats.errorCount === 0);
        });

        it('returns invalid when missing UIDs produce errors', () => {
            const invalidFile: NormalizedDicomFile = {
                ...file,
                summary: {
                    ...file.summary,
                    studyInstanceUID: '',
                    seriesInstanceUID: '',
                    sopInstanceUID: '',
                },
            };

            const result = validateDicomFile(invalidFile);
            expect(result.stats.errorCount).toBeGreaterThan(0);
            expect(result.valid).toBe(false);
        });

        it('counts unsupported character set warnings', () => {
            const invalidFile: NormalizedDicomFile = {
                ...file,
                characterSet: {
                    ...file.characterSet,
                    supported: false,
                    values: ['UNKNOWN_CHARSET'],
                },
            };

            const baseline = validateDicomFile(file);
            const result = validateDicomFile(invalidFile);
            expect(result.diagnostics.filter(diagnostic => diagnostic.code === 'UNSUPPORTED_CHARACTER_SET')).toHaveLength(1);
            expect(result.stats.errorCount).toBe(baseline.stats.errorCount);
        });
    });

    describe('Dataset validation', () => {
        it('validates a dataset containing additional elements', () => {
            const result = validateDicomFile(file);
            expect(result.diagnostics).toBeDefined();
            expect(result.stats).toBeDefined();
        });

        it('accepts a dataset containing a private element', () => {
            const privateFile = createNormalizedFile({
                studyInstanceUID: uid(2),
                seriesInstanceUID: uid(20),
                sopInstanceUID: uid(201),
                additionalElements: [explicitText(0x0011, 0x1010, 'LO', 'PRIVATE_VALUE')],
            });
            const result = validateDicomFile(privateFile);
            expect(result.diagnostics).toBeDefined();
        });
    });

    describe('Consistency and immutability', () => {
        it('returns the same result for repeated validation', () => {
            const first = validateDicomFile(file);
            const second = validateDicomFile(file);
            expect(first).toEqual(second);
        });

        it('does not mutate the normalized file', () => {
            const original = structuredClone(file);
            validateDicomFile(file);
            expect(file).toEqual(original);
        });

        it('does not modify dataset elements', () => {
            const originalElements = structuredClone(file.dataset.elements);
            validateDicomFile(file);
            expect(file.dataset.elements).toEqual(originalElements);
        });
    });
});
