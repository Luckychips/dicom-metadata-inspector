import type {
    DicomInstanceGroup,
    DicomSeriesGroup,
    DicomStudyGroup,
} from './types';

const compareNullableNumber = (left: number | null, right: number | null): number => {
    if (left === null && right === null) {
        return 0;
    }

    if (left === null) {
        return 1;
    }

    if (right === null) {
        return -1;
    }

    return left - right;
};

const compareNullableString = (left: string | null, right: string | null): number => {
    if (left === null && right === null) {
        return 0;
    }

    if (left === null) {
        return 1;
    }

    if (right === null) {
        return -1;
    }

    return left.localeCompare(right);
};

/**
 * Instance 정렬
 *
 * 1. Instance Number
 * 2. SOP Instance UID
 */
export const sortDicomInstances = (instances: DicomInstanceGroup[]): void => {
    instances.sort(
        (left, right) => {
            const numberResult = compareNullableNumber(left.instanceNumber, right.instanceNumber);
            if (numberResult !== 0) {
                return numberResult;
            }

            return left.sopInstanceUID.localeCompare(right.sopInstanceUID);
        }
    );
};

/**
 * Series 정렬
 *
 * 1. Series Number
 * 2. Series Instance UID
 */
export const sortDicomSeries = (series: DicomSeriesGroup[]): void => {
    series.sort(
        (left, right) => {
            const numberResult = compareNullableNumber(left.seriesNumber, right.seriesNumber);
            if (numberResult !== 0) {
                return numberResult;
            }

            return left.seriesInstanceUID.localeCompare(right.seriesInstanceUID);
        }
    );
};

/**
 * Study 정렬
 *
 * 1. Study Date
 * 2. Study Time
 * 3. Study Instance UID
 */
export const sortDicomStudies = (studies: DicomStudyGroup[]): void => {
    studies.sort(
        (left, right) => {
            const dateResult = compareNullableString(left.studyDate, right.studyDate);
            if (dateResult !== 0) {
                return dateResult;
            }

            const timeResult = compareNullableString(left.studyTime, right.studyTime);
            if (timeResult !== 0) {
                return timeResult;
            }

            return left.studyInstanceUID.localeCompare(right.studyInstanceUID);
        }
    );
};

/**
 * 전체 계층 정렬
 */
export const sortDicomHierarchy = (studies: DicomStudyGroup[]): void => {
    for (const study of studies) {
        for (const series of study.series) {
            sortDicomInstances(series.instances);
        }

        sortDicomSeries(study.series);
    }

    sortDicomStudies(studies);
};
