import type {
    DicomGroupingFile,
    DicomGroupingIssue,
    DicomGroupingResult,
    DicomGroupingStats,
    DicomInstanceGroup,
    DicomSeriesGroup,
    DicomStudyGroup,
} from './types';
import { sortDicomHierarchy } from './_';

interface MutableSeriesGroup {
    seriesInstanceUID: string;
    seriesNumber: number | null;
    modality: string | null;
    description: string | null;
    instances: Map<string, DicomInstanceGroup>;
}

interface MutableStudyGroup {
    studyInstanceUID: string;
    studyDate: string | null;
    studyTime: string | null;
    description: string | null;
    patientName: string | null;
    patientID: string | null;
    series: Map<string, MutableSeriesGroup>;
}

/**
 * UID 문자열 검증
 *
 * 여기서는 DICOM UID 문법 전체 검증이 아니라
 * grouping key로 사용할 수 있는지만 확인한다.
 *
 * UID 문법 자체 검증은 별도 validation 단계의 책임.
 */
const hasUID = (value: string | null): value is string => {
    return (typeof value === 'string' && value.trim().length > 0);
};

/**
 * Missing Study UID issue
 */
const createMissingStudyIssue = (input: DicomGroupingFile): DicomGroupingIssue => ({
    code: 'MISSING_STUDY_INSTANCE_UID',
    fileId: input.fileId,
    file: input.file,
    message: 'Study Instance UID is missing.',
});

/**
 * Missing Series UID issue
 */
const createMissingSeriesIssue = (input: DicomGroupingFile, studyInstanceUID: string): DicomGroupingIssue => ({
    code: 'MISSING_SERIES_INSTANCE_UID',
    fileId: input.fileId,
    file: input.file,
    studyInstanceUID,
    message: 'Series Instance UID is missing.',
});

/**
 * Missing SOP UID issue
 */
const createMissingSOPIssue = (
    input: DicomGroupingFile,
    studyInstanceUID: string,
    seriesInstanceUID: string
): DicomGroupingIssue => ({
    code: 'MISSING_SOP_INSTANCE_UID',
    fileId: input.fileId,
    file: input.file,
    studyInstanceUID,
    seriesInstanceUID,
    message: 'SOP Instance UID is missing.',
});

/**
 * Duplicate SOP UID issue
 */
const createDuplicateIssue = (
    input: DicomGroupingFile,
    existing: DicomInstanceGroup,
    studyInstanceUID: string,
    seriesInstanceUID: string,
    sopInstanceUID: string
): DicomGroupingIssue => ({
    code: 'DUPLICATE_SOP_INSTANCE_UID',
    fileId: input.fileId,
    file: input.file,
    studyInstanceUID,
    seriesInstanceUID,
    sopInstanceUID,
    existingFileId: existing.fileId,
    message: `Duplicate SOP Instance UID: ${sopInstanceUID}`,
});

/**
 * 새로운 Study 생성
 */
const createStudy = (input: DicomGroupingFile, studyInstanceUID: string): MutableStudyGroup => {
    const summary = input.normalized.summary;
    return {
        studyInstanceUID,
        studyDate: summary.studyDate,
        studyTime: summary.studyTime,
        description: summary.studyDescription,
        patientName: summary.patientName,
        patientID: summary.patientID,
        series: new Map(),
    };
};

/**
 * 새로운 Series 생성
 */
const createSeries = (input: DicomGroupingFile, seriesInstanceUID: string): MutableSeriesGroup => {
    const summary = input.normalized.summary;
    return {
        seriesInstanceUID,
        seriesNumber: summary.seriesNumber,
        modality: summary.modality,
        description: summary.seriesDescription,
        instances: new Map(),
    };
};

/**
 * 새로운 Instance 생성
 */
const createInstance = (input: DicomGroupingFile, sopInstanceUID: string): DicomInstanceGroup => ({
    sopInstanceUID,
    instanceNumber: input.normalized.summary.instanceNumber,
    fileId: input.fileId,
    file: input.file,
    parsed: input.parsed,
    normalized: input.normalized,
});

/**
 * 내부 Map 구조를 외부 배열 구조로 변환
 */
const finalizeStudies = (studyMap: Map<string, MutableStudyGroup>): DicomStudyGroup[] => {
    const studies: DicomStudyGroup[] = [];

    for (const mutableStudy of studyMap.values()) {
        const series: DicomSeriesGroup[] = [];

        for (const mutableSeries of mutableStudy.series.values()) {
            series.push({
                seriesInstanceUID: mutableSeries.seriesInstanceUID,
                seriesNumber: mutableSeries.seriesNumber,
                modality: mutableSeries.modality,
                description: mutableSeries.description,
                instances: Array.from(mutableSeries.instances.values()),
            });
        }

        studies.push({
            studyInstanceUID: mutableStudy.studyInstanceUID,
            studyDate: mutableStudy.studyDate,
            studyTime: mutableStudy.studyTime,
            description: mutableStudy.description,
            patientName: mutableStudy.patientName,
            patientID: mutableStudy.patientID,
            series,
        });
    }

    return studies;
};

/**
 * 통계 생성
 */
const createStats = (
    inputFileCount: number,
    studies: readonly DicomStudyGroup[],
    issues: readonly DicomGroupingIssue[]
): DicomGroupingStats => {
    let seriesCount = 0;
    let instanceCount = 0;

    for (const study of studies) {
        seriesCount += study.series.length;

        for (const series of study.series) {
            instanceCount += series.instances.length;
        }
    }

    const duplicateInstanceCount = issues.filter(issue => issue.code === 'DUPLICATE_SOP_INSTANCE_UID').length;
    const missingUIDCount = issues.filter(issue => issue.code !== 'DUPLICATE_SOP_INSTANCE_UID').length;

    return {
        inputFileCount,
        groupedFileCount: instanceCount,
        studyCount: studies.length,
        seriesCount,
        instanceCount,
        issueCount: issues.length,
        duplicateInstanceCount,
        missingUIDCount,
    };
};

export const groupDicomFiles = (inputs: readonly DicomGroupingFile[]): DicomGroupingResult => {
    const studies = new Map<string, MutableStudyGroup>();

    /**
     * SOP Instance UID는 Dataset 전체에서
     * 유일해야 하므로 Series Map과 별도로
     * global lookup을 유지한다.
     */
    const sopInstances = new Map<string, DicomInstanceGroup>();
    const issues: DicomGroupingIssue[] = [];

    for (const input of inputs) {
        const summary = input.normalized.summary;
        const studyInstanceUID = summary.studyInstanceUID;
        const seriesInstanceUID = summary.seriesInstanceUID;
        const sopInstanceUID = summary.sopInstanceUID;

        if (!hasUID(studyInstanceUID)) {
            issues.push(createMissingStudyIssue(input));
            continue;
        }

        if (!hasUID(seriesInstanceUID)) {
            issues.push(createMissingSeriesIssue(input, studyInstanceUID));
            continue;
        }

        if (!hasUID(sopInstanceUID)) {
            issues.push(createMissingSOPIssue(input, studyInstanceUID, seriesInstanceUID));
            continue;
        }

        const existingInstance = sopInstances.get(sopInstanceUID);
        if (existingInstance) {
            issues.push(createDuplicateIssue(input, existingInstance, studyInstanceUID, seriesInstanceUID, sopInstanceUID));
            continue;
        }

        let study = studies.get(studyInstanceUID);
        if (!study) {
            study = createStudy(input, studyInstanceUID);
            studies.set(studyInstanceUID, study);
        }

        let series = study.series.get(seriesInstanceUID);
        if (!series) {
            series = createSeries(input, seriesInstanceUID);
            study.series.set(seriesInstanceUID, series);
        }

        const instance = createInstance(input, sopInstanceUID);
        series.instances.set(sopInstanceUID, instance);
        sopInstances.set(sopInstanceUID, instance);
    }

    const finalizedStudies = finalizeStudies(studies);

    sortDicomHierarchy(finalizedStudies);

    const stats = createStats(inputs.length, finalizedStudies, issues);
    return {
        studies: finalizedStudies,
        issues,
        stats,
    };
};
