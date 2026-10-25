import { beforeEach, describe, expect, it } from 'vitest';
import { groupDicomFiles, normalizeDicomFile, parseDicomBuffer } from '@/cores';
import type { DicomGroupingFile } from '@/cores';
import { createDicomFixture } from '../fixtures/dicom';
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

const countInstances = (result: ReturnType<typeof groupDicomFiles>): number => {
    return result.studies.reduce((studyTotal, study) =>
            studyTotal + study.series.reduce((seriesTotal, series) => seriesTotal + series.instances.length, 0),
    0);
};

describe('Study / Series / Instance Grouping', () => {
    let files: DicomGroupingFile[];

    beforeEach(() => {
        fileSequence = 0;
        files = [
            createGroupingFile({
                studyInstanceUID: uid(1),
                seriesInstanceUID: uid(10),
                sopInstanceUID: uid(101),
                modality: 'CT',
            }),
            createGroupingFile({
                studyInstanceUID: uid(1),
                seriesInstanceUID: uid(10),
                sopInstanceUID: uid(102),
                modality: 'CT',
            }),
            createGroupingFile({
                studyInstanceUID: uid(1),
                seriesInstanceUID: uid(20),
                sopInstanceUID: uid(201),
                modality: 'MR',
            }),
            createGroupingFile({
                studyInstanceUID: uid(2),
                seriesInstanceUID: uid(30),
                sopInstanceUID: uid(301),
                modality: 'CT',
            }),
        ];
    });

    describe('Empty input', () => {
        it('returns no studies for empty input', () => {
            const result = groupDicomFiles([]);
            expect(result.studies).toHaveLength(0);
            expect(countInstances(result)).toBe(0);
        });
    });

    describe('Single instance', () => {
        it('creates one Study, Series and Instance', () => {
            const result = groupDicomFiles([files[0]]);
            expect(result.studies).toHaveLength(1);
            expect(result.studies[0].series).toHaveLength(1);
            expect(result.studies[0].series[0].instances).toHaveLength(1);
            expect(countInstances(result)).toBe(1);
        });
    });

    describe('Same Study and Series', () => {
        it('groups multiple instances into one Series', () => {
            const result = groupDicomFiles(files.slice(0, 2));
            expect(result.studies).toHaveLength(1);
            expect(result.studies[0].series).toHaveLength(1);
            expect(result.studies[0].series[0].instances).toHaveLength(2);
            expect(countInstances(result)).toBe(2);
        });

        it('does not create duplicate Series groups', () => {
            const result = groupDicomFiles(files.slice(0, 2));
            expect(result.studies).toHaveLength(1);
            expect(result.studies[0].series).toHaveLength(1);
            expect(countInstances(result)).toBe(2);
        });
    });

    describe('Multiple Series', () => {
        it('separates Series within the same Study', () => {
            const result = groupDicomFiles(files.slice(0, 3));
            expect(result.studies).toHaveLength(1);
            expect(result.studies[0].series).toHaveLength(2);
            expect(countInstances(result)).toBe(3);
            const seriesCounts = result.studies[0].series.map((series) => series.instances.length).sort((a, b) => a - b);
            expect(seriesCounts).toEqual([1, 2]);
        });

        it('keeps instances in their respective Series', () => {
            const result = groupDicomFiles(files.slice(0, 3));
            const series = result.studies[0].series;
            expect(series).toHaveLength(2);
            const counts = series.map((entry) => entry.instances.length).sort((a, b) => a - b);
            expect(counts).toEqual([1, 2]);
        });
    });

    describe('Multiple Studies', () => {
        it('separates different Study Instance UIDs', () => {
            const result = groupDicomFiles(files);
            expect(result.studies).toHaveLength(2);
            expect(countInstances(result)).toBe(4);
            const seriesCounts = result.studies.map((study) => study.series.length).sort((a, b) => a - b);
            expect(seriesCounts).toEqual([1, 2]);
        });

        it('does not merge different Studies sharing a Series UID', () => {
            const secondStudyFile = createGroupingFile({
                studyInstanceUID: uid(2),
                seriesInstanceUID: uid(10),
                sopInstanceUID: uid(202),
                modality: 'CT',
            });
            const result = groupDicomFiles([files[0], secondStudyFile]);
            expect(result.studies).toHaveLength(2);
            expect(countInstances(result)).toBe(2);
            expect(result.studies.every((study) => study.series.length === 1)).toBe(true);
        });

        it('preserves all instances across Studies', () => {
            const result = groupDicomFiles(files);
            expect(countInstances(result)).toBe(files.length);
        });
    });

    describe('Modality', () => {
        it('groups CT and MR Series under the same Study', () => {
            const result = groupDicomFiles([files[0], files[2]]);
            expect(result.studies).toHaveLength(1);
            expect(result.studies[0].series).toHaveLength(2);
            expect(countInstances(result)).toBe(2);
        });

        it('does not split the same Series by file count', () => {
            const result = groupDicomFiles(files.slice(0, 2));
            expect(result.studies).toHaveLength(1);
            expect(result.studies[0].series).toHaveLength(1);
            expect(countInstances(result)).toBe(2);
        });
    });

    describe('Input ordering', () => {
        it('preserves grouping counts regardless of file order', () => {
            const first = groupDicomFiles(files);
            const reversed = groupDicomFiles([...files].reverse());
            expect(first.studies).toHaveLength(2);
            expect(reversed.studies).toHaveLength(2);
            expect(countInstances(first)).toBe(4);
            expect(countInstances(reversed)).toBe(4);
            const getSeriesCounts = (result: ReturnType<typeof groupDicomFiles>): number[] => {
                return result.studies.map((study) => study.series.length).sort((a, b) => a - b);
            }
            expect(getSeriesCounts(first)).toEqual([1, 2]);
            expect(getSeriesCounts(first)).toEqual(getSeriesCounts(reversed));
        });

        it('preserves Instance count when input is reversed', () => {
            const reversed = groupDicomFiles([...files].reverse());
            expect(countInstances(reversed)).toBe(files.length);
        });
    });

    describe('Input immutability', () => {
        it('does not modify the input array order', () => {
            const originalOrder = files.map((file) => file.fileId);
            groupDicomFiles(files);
            expect(files.map((file) => file.fileId)).toEqual(originalOrder);
        });

        it('does not remove elements from the input array', () => {
            const originalLength = files.length;
            groupDicomFiles(files);
            expect(files).toHaveLength(originalLength);
        });
    });

    describe('Repeatability', () => {
        it('produces equivalent grouping for repeated calls', () => {
            const first = groupDicomFiles(files);
            const second = groupDicomFiles(files);
            expect(first).toEqual(second);
        });

        it('does not accumulate instances across calls', () => {
            const first = groupDicomFiles(files);
            const second = groupDicomFiles(files);
            expect(countInstances(first)).toBe(4);
            expect(countInstances(second)).toBe(4);
        });
    });
});
