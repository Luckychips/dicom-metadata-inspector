import { beforeEach, describe, expect, it } from 'vitest';
import { getDicomMetadata, groupDicomFiles, normalizeDicomFile, parseDicomBuffer } from '@/cores';
import type { DicomGroupingFile, DicomGroupingResult } from '@/cores';
import { createDicomFixture, explicitText } from '../fixtures/dicom';
import type { DicomFixtureOptions } from '../fixtures/dicom';

const uid = (value: number): string => `1.2.826.0.1.3680043.10.1000.${value}`;
const createGroupingFile = (fileId: string, options: DicomFixtureOptions): DicomGroupingFile => {
    const buffer = createDicomFixture(options);
    const parsed = parseDicomBuffer(buffer);
    return {
        fileId,
        file: new File([buffer], `${fileId}.dcm`, { type: 'application/dicom' }),
        parsed,
        normalized: normalizeDicomFile(parsed),
    };
};

describe('Metadata Export', () => {
    let grouping: DicomGroupingResult;

    beforeEach(() => {
        const files = [
            createGroupingFile('file-1', {
                studyInstanceUID: uid(1),
                seriesInstanceUID: uid(10),
                sopInstanceUID: uid(101),
                patientName: 'ALPHA_PATIENT',
                patientID: 'PAT001',
                modality: 'CT',
                additionalElements: [
                    explicitText(
                        0x0008,
                        0x1030,
                        'LO',
                        'Brain CT',
                    ),
                ],
            }),
            createGroupingFile('file-2', {
                studyInstanceUID: uid(1),
                seriesInstanceUID: uid(10),
                sopInstanceUID: uid(102),
                patientName: 'BETA_PATIENT',
                patientID: 'PAT002',
                modality: 'CT',
            }),
            createGroupingFile('file-3', {
                studyInstanceUID: uid(2),
                seriesInstanceUID: uid(20),
                sopInstanceUID: uid(201),
                patientName: 'GAMMA_PATIENT',
                patientID: 'PAT003',
                modality: 'MR',
            }),
        ];

        grouping = groupDicomFiles(files);
    });

    const parseJson = (result: ReturnType<typeof getDicomMetadata>) => JSON.parse(result.content);
    const getAllInstances = (data: ReturnType<typeof parseJson>) =>
        data.studies.flatMap((study: {
            series: {
                instances: {
                    fileId: string;
                    metadata: {
                        tag: string;
                        value: unknown;
                    }[];
                }[];
            }[];
        }) => study.series.flatMap(series => series.instances));

    describe('JSON Export', () => {
        it('exports the expected metadata structure', () => {
            const result = getDicomMetadata(grouping, 'json');
            const data = parseJson(result);
            expect(data.formatVersion).toBe('1.0');
            expect(data.source).toBe('dicom-metadata-inspector');
            expect(data.studies).toHaveLength(2);
            expect(data.stats).toEqual(grouping.stats);
        });

        it('exports all DICOM instances', () => {
            const data = parseJson(getDicomMetadata(grouping, 'json'));
            const instances = getAllInstances(data);
            expect(instances).toHaveLength(3);
            expect(instances.map((instance: { fileId: string }) => instance.fileId)).toEqual(expect.arrayContaining([
                'file-1',
                'file-2',
                'file-3',
            ]));
        });

        it('preserves Study and Series UIDs', () => {
            const data = parseJson(getDicomMetadata(grouping, 'json'));
            expect(data.studies.map((study: { studyInstanceUID: string }) => study.studyInstanceUID))
                .toEqual(expect.arrayContaining([uid(1), uid(2)]));

            const seriesUIDs = data.studies.flatMap((study: {
                series: { seriesInstanceUID: string }[];
            }) => study.series.map(series => series.seriesInstanceUID));
            expect(seriesUIDs).toEqual(expect.arrayContaining([uid(10), uid(20)]));
        });

        it('excludes sensitive tags by default', () => {
            const data = parseJson(getDicomMetadata(grouping, 'json'));
            const instances = getAllInstances(data);
            for (const instance of instances) {
                expect(instance.metadata.some((element: { tag: string }) => element.tag === '00100010' || element.tag === '00100020'))
                    .toBe(false);
            }
        });

        it('includes sensitive tags when enabled', () => {
            const data = parseJson(getDicomMetadata(grouping, 'json', {
                includeSensitiveData: true,
            }));
            const instances = getAllInstances(data);
            const patientIDs = instances.flatMap((instance: {
                metadata: { tag: string; value: unknown }[];
            }) => instance.metadata.filter(element => element.tag === '00100020')
                .map(element => element.value));
            expect(patientIDs).toEqual(expect.arrayContaining(['PAT001', 'PAT002', 'PAT003']));
        });

        it('exports metadata values and lengths', () => {
            const data = parseJson(getDicomMetadata(grouping, 'json'));
            const instance = getAllInstances(data).find((item: { fileId: string }) => item.fileId === 'file-1');
            const description = instance?.metadata.find((element: { tag: string }) => element.tag === '00081030');
            expect(description).toMatchObject({
                tag: '00081030',
                value: 'Brain CT',
            });
            expect(description?.valueLength).toBeGreaterThan(0);
        });

        it('supports compact JSON', () => {
            const result = getDicomMetadata(grouping, 'json', {
                prettyPrint: false,
            });
            expect(result.content).toBe(JSON.stringify(JSON.parse(result.content)));
        });

        it('supports formatted JSON', () => {
            const result = getDicomMetadata(grouping, 'json', {
                prettyPrint: true,
            });
            expect(result.content).toBe(JSON.stringify(JSON.parse(result.content), null, 2));
        });
    });

    describe('CSV Export', () => {
        it('exports the expected header', () => {
            const result = getDicomMetadata(grouping, 'csv');
            expect(result.content).toMatch(
                /^\uFEFF"fileId","fileName","studyInstanceUID","seriesInstanceUID","sopInstanceUID","path","tag","name","keyword","vr","value","valueLength"/,
            );
        });

        it('includes UTF-8 BOM', () => {
            const result = getDicomMetadata(grouping, 'csv');
            expect(result.content.startsWith('\uFEFF')).toBe(true);
        });

        it('exports metadata for all files', () => {
            const result = getDicomMetadata(grouping, 'csv');
            expect(result.content).toContain('"file-1"');
            expect(result.content).toContain('"file-2"');
            expect(result.content).toContain('"file-3"');
        });

        it('exports Study, Series and SOP UIDs', () => {
            const result = getDicomMetadata(grouping, 'csv');
            expect(result.content).toContain(uid(1));
            expect(result.content).toContain(uid(10));
            expect(result.content).toContain(uid(101));
        });

        it('excludes sensitive values by default', () => {
            const result = getDicomMetadata(grouping, 'csv');
            expect(result.content).not.toContain('"PAT001"');
            expect(result.content).not.toContain('"PAT002"');
            expect(result.content).not.toContain('"PAT003"');
        });

        it('includes sensitive values when enabled', () => {
            const result = getDicomMetadata(grouping, 'csv', {
                includeSensitiveData: true,
            });
            expect(result.content).toContain('"PAT001"');
            expect(result.content).toContain('"PAT002"');
            expect(result.content).toContain('"PAT003"');
        });

        it('exports metadata values', () => {
            const result = getDicomMetadata(grouping, 'csv');
            expect(result.content).toContain('"Brain CT"');
        });

        it('uses CRLF line endings', () => {
            const result = getDicomMetadata(grouping, 'csv');
            expect(result.content).toContain('\r\n');
        });
    });

    describe('Export options and consistency', () => {
        it('creates JSON and CSV file names', () => {
            expect(getDicomMetadata(grouping, 'json', { fileName: 'metadata' }).fileName).toBe('metadata.json');
            expect(getDicomMetadata(grouping, 'csv', { fileName: 'metadata' }).fileName).toBe('metadata.csv');
        });

        it('returns the correct MIME types', () => {
            expect(getDicomMetadata(grouping, 'json').mimeType).toBe('application/json;charset=utf-8');
            expect(getDicomMetadata(grouping, 'csv').mimeType).toBe('text/csv;charset=utf-8');
        });

        it('produces deterministic JSON output', () => {
            const first = getDicomMetadata(grouping, 'json');
            const second = getDicomMetadata(grouping, 'json');
            expect(first).toEqual(second);
        });

        it('produces deterministic CSV output', () => {
            const first = getDicomMetadata(grouping, 'csv');
            const second = getDicomMetadata(grouping, 'csv');
            expect(first).toEqual(second);
        });

        it('does not mutate the grouping data', () => {
            const original = structuredClone(grouping.stats);
            getDicomMetadata(grouping, 'json');
            getDicomMetadata(grouping, 'csv');
            expect(grouping.stats).toEqual(original);
        });

        it('exports an empty grouping', () => {
            const emptyGrouping: DicomGroupingResult = {
                ...grouping,
                studies: [],
            };

            const json = getDicomMetadata(emptyGrouping, 'json');
            const csv = getDicomMetadata(emptyGrouping, 'csv');
            expect(JSON.parse(json.content).studies).toEqual([]);
            expect(csv.content.split('\r\n')).toHaveLength(1);
        });
    });
});
