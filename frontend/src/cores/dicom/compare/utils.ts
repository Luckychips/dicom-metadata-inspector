import type { NormalizedDicomValue } from '@/cores';

const equalUint8Array = (left: Uint8Array, right: Uint8Array): boolean => {
    if (left.byteLength !== right.byteLength) {
        return false;
    }

    for (let i = 0; i < left.byteLength; i++) {
        if (left[i] !== right[i]) {
            return false;
        }
    }

    return true;
};

const isDicomTagValue = (value: unknown): value is {
    group: number;
    element: number;
} => {
    if (typeof value !== 'object' || value === null || Array.isArray(value) || value instanceof Uint8Array) {
        return false;
    }

    return ('group' in value && 'element' in value && typeof value.group === 'number' && typeof value.element === 'number');
};

const equalPrimitiveValue = (left: unknown, right: unknown): boolean => {
    if (left instanceof Uint8Array && right instanceof Uint8Array) {
        return equalUint8Array(left, right);
    }

    if (isDicomTagValue(left) && isDicomTagValue(right)) {
        return (left.group === right.group && left.element === right.element);
    }

    return left === right;
};

export const areDicomValuesEqual = (left: NormalizedDicomValue, right: NormalizedDicomValue): boolean => {
    if (Array.isArray(left) && Array.isArray(right)) {
        if (left.length !== right.length) {
            return false;
        }

        for (let i = 0; i < left.length; i++) {
            if (!equalPrimitiveValue(left[i], right[i])) {
                return false;
            }
        }

        return true;
    }

    if (Array.isArray(left) || Array.isArray(right)) {
        return false;
    }

    return equalPrimitiveValue(left, right);
};

export const normalizeComparisonTag = (value: string): string | null => {
    const normalized = value.trim().replace(/[(),\s]/g, '').toUpperCase();
    if (!/^[0-9A-F]{8}$/.test(normalized)) {
        return null;
    }

    return normalized;
};

export const createIgnoredTagSet = (tags: readonly string[] | undefined): Set<string> => {
    const result = new Set<string>();
    if (!tags) {
        return result;
    }

    for (const tag of tags) {
        const normalized = normalizeComparisonTag(tag);
        if (normalized !== null) {
            result.add(normalized);
        }
    }

    return result;
};
