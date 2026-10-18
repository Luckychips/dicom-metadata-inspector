import type { NormalizedDicomElement } from '@/cores';
import type { DicomComparisonPathSegment, DicomElementComparison } from './types';
import { areDicomValuesEqual } from './_';

const getReferenceElement = (
    left: NormalizedDicomElement | null,
    right: NormalizedDicomElement | null
): NormalizedDicomElement => {
    const element = left ?? right;
    if (!element) {
        throw new Error('At least one DICOM element is required.');
    }

    return element;
};

export const compareDicomElement = (
    left: NormalizedDicomElement | null,
    right: NormalizedDicomElement | null,
    path: readonly DicomComparisonPathSegment[] = []
): DicomElementComparison => {
    const reference = getReferenceElement(left, right);
    if (left === null) {
        return {
            tag: reference.tag,
            formattedTag: reference.formattedTag,
            name: reference.name,
            keyword: reference.keyword,
            path: [...path],
            status: 'ADDED',
            leftElement: null,
            rightElement: right,
            leftVR: null,
            rightVR: right?.vr ?? null,
            leftValue: null,
            rightValue: right?.value ?? null,
        };
    }

    if (right === null) {
        return {
            tag: reference.tag,
            formattedTag: reference.formattedTag,
            name: reference.name,
            keyword: reference.keyword,
            path: [...path],
            status: 'REMOVED',
            leftElement: left,
            rightElement: null,
            leftVR: left.vr,
            rightVR: null,
            leftValue: left.value,
            rightValue: null,
        };
    }

    if (left.vr !== right.vr) {
        return {
            tag: reference.tag,
            formattedTag: reference.formattedTag,
            name: reference.name,
            keyword: reference.keyword,
            path: [...path],
            status: 'VR_CHANGED',
            leftElement: left,
            rightElement: right,
            leftVR: left.vr,
            rightVR: right.vr,
            leftValue: left.value,
            rightValue: right.value,
        };
    }

    if (!areDicomValuesEqual(left.value, right.value)) {
        return {
            tag: reference.tag,
            formattedTag: reference.formattedTag,
            name: reference.name,
            keyword: reference.keyword,
            path: [...path],
            status: 'VALUE_CHANGED',
            leftElement: left,
            rightElement: right,
            leftVR: left.vr,
            rightVR: right.vr,
            leftValue: left.value,
            rightValue: right.value,
        };
    }

    return {
        tag: reference.tag,
        formattedTag: reference.formattedTag,
        name: reference.name,
        keyword: reference.keyword,
        path: [...path],
        status: 'SAME',
        leftElement: left,
        rightElement: right,
        leftVR: left.vr,
        rightVR: right.vr,
        leftValue: left.value,
        rightValue: right.value,
    };
};
