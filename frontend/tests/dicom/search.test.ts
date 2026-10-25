import { beforeEach, describe, expect, it } from 'vitest';
import {
    groupDicomFiles,
    normalizeDicomFile,
    parseDicomBuffer,
    searchDicomFiles,
} from '@/cores';
import type {
    DicomGroupingFile,
    DicomGroupingResult,
} from '@/cores';
import { createDicomFixture, explicitText } from '../fixtures/dicom';
import type { DicomFixtureOptions } from '../fixtures/dicom';

let fileSequence = 0;
const uid = (value: number): string => `1.2.826.0.1.3680043.10.1000.${value}`;
const createGroupingFile = (options: DicomFixtureOptions = {}): DicomGroupingFile => {
    const buffer = createDicomFixture(options);
    const parsed = parseDicomBuffer(buffer);
    const normalized = normalizeDicomFile(parsed);
    const fileId = `test-file-${++fileSequence}`;

    return {
        fileId,
        file: new File([buffer], `${fileId}.dcm`, { type: 'application/dicom' }),
        parsed,
        normalized,
    };
};

describe('DICOM Tag Search', () => {
    let files: DicomGroupingFile[];
    let grouping: DicomGroupingResult;

    beforeEach(() => {
        fileSequence = 0;
        files = [
            createGroupingFile({
                studyInstanceUID: uid(1),
                seriesInstanceUID: uid(10),
                sopInstanceUID: uid(101),
                modality: 'CT',
                patientName: 'ALPHA_PATIENT',
                patientID: 'PAT001',
                additionalElements: [
                    explicitText(0x0008, 0x1030, 'LO', 'Brain CT'),
                    explicitText(0x0008, 0x103e, 'LO', 'Axial Brain'),
                    explicitText(0x0011, 0x1010, 'LO', 'PRIVATE_ALPHA'),
                ],
            }),
            createGroupingFile({
                studyInstanceUID: uid(1),
                seriesInstanceUID: uid(10),
                sopInstanceUID: uid(102),
                modality: 'CT',
                patientName: 'BETA_PATIENT',
                patientID: 'PAT002',
                additionalElements: [
                    explicitText(0x0008, 0x1030, 'LO', 'Chest CT'),
                ],
            }),
            createGroupingFile({
                studyInstanceUID: uid(1),
                seriesInstanceUID: uid(20),
                sopInstanceUID: uid(201),
                modality: 'MR',
                patientName: 'GAMMA_PATIENT',
                patientID: 'PAT003',
                additionalElements: [
                    explicitText(0x0008, 0x1030, 'LO', 'Brain MR'),
                ],
            }),
            createGroupingFile({
                studyInstanceUID: uid(2),
                seriesInstanceUID: uid(30),
                sopInstanceUID: uid(301),
                modality: 'CT',
                patientName: 'DELTA_PATIENT',
                patientID: 'PAT004',
                additionalElements: [
                    explicitText(0x0008, 0x1030, 'LO', 'Abdomen CT'),
                ],
            }),
        ];

        grouping = groupDicomFiles(files);
    });

    describe('Empty query and input', () => {
        it('returns empty results for empty query', () => {
            const result = searchDicomFiles(grouping, '');
            expect(result.query).toBe('');
            expect(result.results).toHaveLength(0);
            expect(result.totalMatches).toBe(0);
            expect(result.truncated).toBe(false);
        });

        it('returns empty results for whitespace query', () => {
            const result = searchDicomFiles(grouping, '   ');
            expect(result.results).toHaveLength(0);
            expect(result.totalMatches).toBe(0);
            expect(result.truncated).toBe(false);
        });

        it('returns empty results for empty grouping', () => {
            const emptyGrouping = groupDicomFiles([]);
            const result = searchDicomFiles(emptyGrouping, 'PatientName');
            expect(result.results).toHaveLength(0);
            expect(result.totalMatches).toBe(0);
        });

        it('returns no matches for unknown query', () => {
            const result = searchDicomFiles(grouping, 'NON_EXISTENT_SEARCH_VALUE_999');
            expect(result.results).toHaveLength(0);
            expect(result.totalMatches).toBe(0);
            expect(result.truncated).toBe(false);
        });
    });

    describe('Tag search', () => {
        it('searches by 8-digit tag', () => {
            const result = searchDicomFiles(grouping, '00100010', { fields: ['tag'] });
            expect(result.results).toHaveLength(4);
            expect(result.totalMatches).toBe(4);
            expect(result.results.every(entry => entry.element.tag === '00100010')).toBe(true);
        });

        it('searches by formatted tag', () => {
            const result = searchDicomFiles(grouping, '(0010,0010)', { fields: ['tag'] });
            expect(result.results).toHaveLength(4);
        });

        it('searches by comma-separated tag', () => {
            const result = searchDicomFiles(grouping, '0010,0010', { fields: ['tag'] });
            expect(result.results).toHaveLength(4);
        });

        it('does not match partial tag numbers', () => {
            const result = searchDicomFiles(grouping, '0010', { fields: ['tag'] });
            expect(result.results).toHaveLength(0);
        });
    });

    describe('Keyword search', () => {
        it('searches by exact keyword', () => {
            const result = searchDicomFiles(grouping, 'PatientName', { fields: ['keyword'] });
            expect(result.results).toHaveLength(4);
            expect(result.results.every(entry => entry.matchedFields.includes('keyword'))).toBe(true);
        });

        it('supports partial keyword matching', () => {
            const result = searchDicomFiles(grouping, 'Patient', { fields: ['keyword'] });
            expect(result.results.length).toBeGreaterThan(4);
        });

        it('is case-insensitive by default', () => {
            const upper = searchDicomFiles(grouping, 'PATIENTNAME', { fields: ['keyword'] });
            const lower = searchDicomFiles(grouping, 'patientname', { fields: ['keyword'] });
            expect(upper.results).toEqual(lower.results);
        });

        it('supports case-sensitive search', () => {
            const result = searchDicomFiles(grouping, 'patientname', { fields: ['keyword'], caseSensitive: true });
            expect(result.results).toHaveLength(0);
        });
    });

    describe('Name search', () => {
        it('searches by DICOM attribute name', () => {
            const result = searchDicomFiles(grouping, "Patient's Name", { fields: ['name'] });
            expect(result.results).toHaveLength(4);
        });

        it('supports partial name matching', () => {
            const result = searchDicomFiles(grouping, 'Study Description', { fields: ['name'] });
            expect(result.results).toHaveLength(4);
        });
    });

    describe('Value search', () => {
        it('searches a specific Patient ID', () => {
            const result = searchDicomFiles(grouping, 'PAT001', { fields: ['value'] });
            expect(result.results).toHaveLength(1);
            expect(result.results[0].fileId).toBe(files[0].fileId);
            expect(result.results[0].displayValue).toBe('PAT001');
        });

        it('searches a specific Patient Name', () => {
            const result = searchDicomFiles(grouping, 'BETA_PATIENT', { fields: ['value'] });
            expect(result.results).toHaveLength(1);
            expect(result.results[0].fileId).toBe(files[1].fileId);
        });

        it('supports partial value matching', () => {
            const result = searchDicomFiles(grouping, 'Brain', { fields: ['value'] });
            const matchedFileIds = new Set(result.results.map(entry => entry.fileId));
            expect(result.results).toHaveLength(3);
            expect(matchedFileIds.size).toBe(2);
            expect(matchedFileIds).toEqual(new Set([files[0].fileId, files[2].fileId]));
        });

        it('returns no results for unknown value', () => {
            const result = searchDicomFiles(grouping, 'PAT999', { fields: ['value'] });
            expect(result.results).toHaveLength(0);
        });
    });

    describe('VR search', () => {
        it('searches elements by VR', () => {
            const result = searchDicomFiles(grouping, 'PN', { fields: ['vr'] });
            expect(result.results.length).toBeGreaterThan(0);
            expect(result.results.every(entry => entry.element.vr === 'PN')).toBe(true);
        });

        it('does not match unrelated VR', () => {
            const result = searchDicomFiles(grouping, 'ZZ', { fields: ['vr'] });
            expect(result.results).toHaveLength(0);
        });
    });

    describe('Search scope', () => {
        it('filters by Study Instance UID', () => {
            const result = searchDicomFiles(grouping, 'PatientName', { fields: ['keyword'], scope: { studyInstanceUID: uid(1) } });
            expect(result.results).toHaveLength(3);
            expect(result.results.every(entry => entry.studyInstanceUID === uid(1))).toBe(true);
        });

        it('filters by Series Instance UID', () => {
            const result = searchDicomFiles(grouping, 'PatientName', { fields: ['keyword'], scope: { seriesInstanceUID: uid(10) } });
            expect(result.results).toHaveLength(2);
        });

        it('filters by SOP Instance UID', () => {
            const result = searchDicomFiles(grouping, 'PatientName', { fields: ['keyword'], scope: { sopInstanceUID: uid(101) } });
            expect(result.results).toHaveLength(1);
            expect(result.results[0].fileId).toBe(files[0].fileId);
        });

        it('supports combined scope filters', () => {
            const result = searchDicomFiles(grouping, 'PatientName', {
                fields: ['keyword'],
                scope: {
                    studyInstanceUID: uid(1),
                    seriesInstanceUID: uid(10),
                    sopInstanceUID: uid(102),
                },
            });

            expect(result.results).toHaveLength(1);
            expect(result.results[0].fileId).toBe(files[1].fileId);
        });

        it('returns no results for unmatched scope', () => {
            const result = searchDicomFiles(grouping, 'PatientName', {
                fields: ['keyword'],
                scope: {
                    studyInstanceUID: uid(999),
                },
            });
            expect(result.results).toHaveLength(0);
        });
    });

    describe('Private tags', () => {
        it('searches private tag values', () => {
            const result = searchDicomFiles(grouping, 'PRIVATE_ALPHA', { fields: ['value'] });
            expect(result.results).toHaveLength(1);
            expect(result.results[0].fileId).toBe(files[0].fileId);
        });

        it('searches private tag numbers', () => {
            const result = searchDicomFiles(grouping, '00111010', { fields: ['tag'] });
            expect(result.results).toHaveLength(1);
            expect(result.results[0].element.tag).toBe('00111010');
        });
    });

    describe('Search result metadata', () => {
        it('includes file and UID information', () => {
            const result = searchDicomFiles(grouping, 'PAT001', { fields: ['value'] });
            const entry = result.results[0];
            expect(entry.fileId).toBe(files[0].fileId);
            expect(entry.file).toBe(files[0].file);
            expect(entry.studyInstanceUID).toBe(uid(1));
            expect(entry.seriesInstanceUID).toBe(uid(10));
            expect(entry.sopInstanceUID).toBe(uid(101));
        });

        it('provides matched fields', () => {
            const result = searchDicomFiles(grouping, 'PatientName', { fields: ['keyword'] });
            expect(result.results.every(entry => entry.matchedFields.includes('keyword'))).toBe(true);
        });

        it('uses empty path for top-level elements', () => {
            const result = searchDicomFiles(grouping, 'PAT001', { fields: ['value'] });
            expect(result.results[0].path).toEqual([]);
        });

        it('preserves original query in response', () => {
            const query = '  PatientName  ';
            const result = searchDicomFiles(grouping, query, { fields: ['keyword'] });
            expect(result.query).toBe(query);
            expect(result.results).toHaveLength(4);
        });
    });

    describe('Maximum results', () => {
        it('limits the number of results', () => {
            const result = searchDicomFiles(grouping, 'PatientName', {
                fields: ['keyword'],
                maxResults: 2,
            });
            expect(result.results).toHaveLength(2);
            expect(result.totalMatches).toBe(2);
            expect(result.truncated).toBe(true);
        });

        it('rejects zero maxResults', () => {
            expect(() => searchDicomFiles(grouping, 'PatientName', { maxResults: 0 })).toThrow(RangeError);
        });

        it('rejects negative maxResults', () => {
            expect(() => searchDicomFiles(grouping, 'PatientName', { maxResults: -1 })).toThrow(RangeError);
        });

        it('rejects fractional maxResults', () => {
            expect(() => searchDicomFiles(grouping, 'PatientName', { maxResults: 1.5 })).toThrow(RangeError);
        });

        it('rejects infinite maxResults', () => {
            expect(() => searchDicomFiles(grouping, 'PatientName', { maxResults: Infinity })).toThrow(RangeError);
        });
    });

    describe('Search consistency', () => {
        it('produces equivalent results for repeated searches', () => {
            const first = searchDicomFiles(grouping, 'PatientName', { fields: ['keyword'] });
            const second = searchDicomFiles(grouping, 'PatientName', { fields: ['keyword'] });
            expect(first).toEqual(second);
        });

        it('does not mutate the source files array', () => {
            const originalIds = files.map(file => file.fileId);
            searchDicomFiles(grouping, 'PatientName');
            expect(files.map(file => file.fileId)).toEqual(originalIds);
        });

        it('returns totalMatches equal to result count', () => {
            const result = searchDicomFiles(grouping, 'PatientName', { fields: ['keyword'] });
            expect(result.totalMatches).toBe(result.results.length);
        });
    });
});
