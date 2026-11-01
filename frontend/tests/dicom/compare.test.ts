import { beforeEach, describe, expect, it } from 'vitest';
import {
    compareDicomInstances,
    groupDicomFiles,
    normalizeDicomFile,
    parseDicomBuffer,
} from '@/cores';
import type {
    DicomGroupingFile,
    DicomInstanceGroup,
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

const getInstance = (instances: DicomInstanceGroup[], sopInstanceUID: string): DicomInstanceGroup => {
    const instance = instances.find(entry => entry.sopInstanceUID === sopInstanceUID);
    if (!instance) {
        throw new Error(`Instance not found: ${sopInstanceUID}`);
    }

    return instance;
};

const getElement = (instance: DicomInstanceGroup, tag: string) => {
    return instance.normalized.dataset.elements.find(element => element.tag === tag);
};

describe('DICOM Instance Comparison', () => {
    let files: DicomGroupingFile[];
    let instances: DicomInstanceGroup[];
    let left: DicomInstanceGroup;
    let right: DicomInstanceGroup;

    beforeEach(() => {
        fileSequence = 0;
        files = [
            createGroupingFile({
                studyInstanceUID: uid(1),
                seriesInstanceUID: uid(10),
                sopInstanceUID: uid(101),
                patientName: 'ALPHA_PATIENT',
                patientID: 'PAT001',
                modality: 'CT',
                additionalElements: [explicitText(0x0008, 0x1030, 'LO', 'Brain CT')],
            }),
            createGroupingFile({
                studyInstanceUID: uid(1),
                seriesInstanceUID: uid(10),
                sopInstanceUID: uid(102),
                patientName: 'ALPHA_PATIENT',
                patientID: 'PAT001',
                modality: 'CT',
                additionalElements: [explicitText(0x0008, 0x1030, 'LO', 'Brain CT')],
            }),
            createGroupingFile({
                studyInstanceUID: uid(1),
                seriesInstanceUID: uid(20),
                sopInstanceUID: uid(201),
                patientName: 'BETA_PATIENT',
                patientID: 'PAT002',
                modality: 'MR',
                additionalElements: [explicitText(0x0008, 0x1030, 'LO', 'Brain MR')],
            }),
        ];

        const grouping = groupDicomFiles(files);
        instances = grouping.studies.flatMap(study => study.series.flatMap(series => series.instances));
        left = getInstance(instances, uid(101));
        right = getInstance(instances, uid(201));
    });

    describe('Fixture integrity', () => {
        it('creates three grouped instances', () => {
            expect(instances).toHaveLength(3);
        });

        it('preserves SOP Instance UIDs', () => {
            const actualUIDs = instances.map(instance => instance.sopInstanceUID).sort();
            const expectedUIDs = [uid(101), uid(102), uid(201)].sort();
            expect(actualUIDs).toEqual(expectedUIDs);
        });

        it('preserves file identifiers', () => {
            const actualIds = new Set(instances.map(instance => instance.fileId));
            const expectedIds = new Set(files.map(file => file.fileId));
            expect(actualIds).toEqual(expectedIds);
        });
    });

    describe('Identical instances', () => {
        it('compares an instance with itself', () => {
            const instance = getInstance(instances, uid(101));
            const result = compareDicomInstances(instance, instance);
            expect(result).toBeDefined();
        });

        it('produces equivalent results for repeated self-comparison', () => {
            const instance = getInstance(instances, uid(101));
            const first = compareDicomInstances(instance, instance);
            const second = compareDicomInstances(instance, instance);
            expect(first).toEqual(second);
        });
    });

    describe('Different instances', () => {
        it('compares instances within the same Series', () => {
            const result = compareDicomInstances(left, right);
            expect(result).toBeDefined();
        });

        it('compares instances from different Series', () => {
            const result = compareDicomInstances(left, right);
            expect(result).toBeDefined();
        });

        it('supports comparisons in both directions', () => {
            const forward = compareDicomInstances(left, right);
            const backward = compareDicomInstances(right, left);
            expect(forward).toBeDefined();
            expect(backward).toBeDefined();
        });
    });

    describe('Changed metadata', () => {
        it('prepares different Patient IDs for comparison', () => {
            const leftElement = getElement(left, '00100020');
            const rightElement = getElement(right, '00100020');
            expect(leftElement).toBeDefined();
            expect(rightElement).toBeDefined();
            expect(leftElement?.value).not.toEqual(rightElement?.value);
            const result = compareDicomInstances(left, right);
            expect(result).toBeDefined();
        });

        it('prepares different Modalities for comparison', () => {
            expect(getElement(left, '00080060')?.value,).not.toEqual(getElement(right, '00080060')?.value);
            const result = compareDicomInstances(left, right);
            expect(result).toBeDefined();
        });

        it('prepares different Study Descriptions for comparison', () => {
            expect(getElement(left, '00081030')?.value).not.toEqual(getElement(right, '00081030')?.value);
            const result = compareDicomInstances(left, right);
            expect(result).toBeDefined();
        });

        it('prepares matching Patient IDs for comparison', () => {
            const left = getInstance(instances, uid(101));
            const right = getInstance(instances, uid(102));
            expect(getElement(left, '00100020')?.value).toEqual(getElement(right, '00100020')?.value);
            const result = compareDicomInstances(left, right);
            expect(result).toBeDefined();
        });
    });

    describe('Added and removed elements', () => {
        it('compares an element present only in the right instance', () => {
            const leftFile = createGroupingFile({
                studyInstanceUID: uid(3),
                seriesInstanceUID: uid(30),
                sopInstanceUID: uid(301),
            });

            const rightFile = createGroupingFile({
                studyInstanceUID: uid(3),
                seriesInstanceUID: uid(30),
                sopInstanceUID: uid(302),
                additionalElements: [explicitText(0x0008, 0x103e, 'LO', 'Additional Series')],
            });

            const grouping = groupDicomFiles([leftFile, rightFile]);
            const comparisonInstances = grouping.studies.flatMap(study => study.series.flatMap(series => series.instances));
            const left = getInstance(comparisonInstances, uid(301));
            const right = getInstance(comparisonInstances, uid(302));
            expect(getElement(left, '0008103E')).toBeUndefined();
            expect(getElement(right, '0008103E')).toBeDefined();
            const result = compareDicomInstances(left, right);
            expect(result).toBeDefined();
        });

        it('compares an element present only in the left instance', () => {
            const extraFile = createGroupingFile({
                studyInstanceUID: uid(4),
                seriesInstanceUID: uid(40),
                sopInstanceUID: uid(401),
            });
            const extraGrouping = groupDicomFiles([extraFile]);
            const extraInstance = extraGrouping.studies[0].series[0].instances[0];
            expect(getElement(left, '00081030')).toBeDefined();
            expect(getElement(extraInstance, '00081030')).toBeUndefined();
            const result = compareDicomInstances(left, extraInstance);
            expect(result).toBeDefined();
            expect(right).toBeDefined();
        });
    });

    describe('Comparison consistency', () => {
        it('returns equivalent results for repeated comparisons', () => {
            const first = compareDicomInstances(left, right);
            const second = compareDicomInstances(left, right);
            expect(first).toEqual(second);
        });

        it('does not mutate normalized source datasets', () => {
            const leftBefore = structuredClone(left.normalized);
            const rightBefore = structuredClone(right.normalized);
            compareDicomInstances(left, right);
            expect(left.normalized).toEqual(leftBefore);
            expect(right.normalized).toEqual(rightBefore);
        });

        it('does not modify the input instances array', () => {
            const originalIds = instances.map(instance => instance.fileId);
            compareDicomInstances(left, right);
            expect(instances.map(instance => instance.fileId)).toEqual(originalIds);
        });
    });
});
