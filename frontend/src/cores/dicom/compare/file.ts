import type { DicomInstanceGroup } from '@/cores';
import type {
    DicomCompareOptions,
    DicomFileComparison,
    DicomFileComparisonSource,
} from './types';
import { compareNormalizedDatasets } from './_';

export const compareDicomFiles = (
    left: DicomFileComparisonSource,
    right: DicomFileComparisonSource,
    options: DicomCompareOptions = {}
): DicomFileComparison => {
    const dataset = compareNormalizedDatasets(left.normalized.dataset.elements, right.normalized.dataset.elements, options);
    return {
        left,
        right,
        dataset,
        identical: dataset.identical,
    };
};

export const compareDicomInstances = (
    left: DicomInstanceGroup,
    right: DicomInstanceGroup,
    options: DicomCompareOptions = {}
): DicomFileComparison => {
    const aFile = {
        fileId: left.fileId,
        file: left.file,
        normalized: left.normalized,
    };
    const bFile = {
        fileId: right.fileId,
        file: right.file,
        normalized: right.normalized,
    }

    return compareDicomFiles(aFile, bFile, options);
};
