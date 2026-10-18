import { createTagKey } from '@/cores';
import type { NormalizedDicomElement, NormalizedDicomValue } from './types';

/**
 * Normalized Element 조회
 *
 * 현재 Dataset 레벨에서만 조회한다.
 * SQ 내부까지 검색하지 않는다.
 */
export const findNormalizedElement = (
    elements: readonly NormalizedDicomElement[],
    group: number,
    element: number
): NormalizedDicomElement | null => {
    const key = createTagKey(group, element);
    return (elements.find(item => item.tag === key) ?? null);
};

export const formatDicomTag = (group: number, element: number): string => {
    const groupHex = group.toString(16).toUpperCase().padStart(4, '0');
    const elementHex = element.toString(16).toUpperCase().padStart(4, '0');
    return `(${groupHex},${elementHex})`;
};

/**
 * Dataset에서 숫자 Attribute 조회
 */
export const getNormalizedNumber = (
    elements: readonly NormalizedDicomElement[],
    group: number,
    element: number
): number | null => {
    const found = findNormalizedElement(elements, group, element);
    return found ? toNormalizedNumber(found.value) : null;
};

/**
 * Dataset에서 문자열 Attribute 조회
 */
export const getNormalizedString = (
    elements: readonly NormalizedDicomElement[],
    group: number,
    element: number
): string | null => {
    const found = findNormalizedElement(elements, group, element);
    return found ? toNormalizedString(found.value) : null;
};

/**
 * Value를 숫자로 변환
 *
 * Series Number, Instance Number,
 * Rows, Columns 등에 사용.
 */
export const toNormalizedNumber = (value: NormalizedDicomValue): number | null => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'bigint') {
        const numberValue = Number(value);
        return Number.isSafeInteger(numberValue) ? numberValue : null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
            return null;
        }

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
};

/**
 * Value를 문자열로 변환
 *
 * UID, PN, CS, LO 등의 요약 정보 추출에 사용.
 */
export const toNormalizedString = (value: NormalizedDicomValue): string | null => {
    if (typeof value === 'string') {
        return value || null;
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
        return String(value);
    }

    return null;
};
