import type { NormalizedDicomElement, NormalizedDicomValue } from '@/cores';
import type { DicomSearchField } from './types';

const includesSearchText = (source: string | null, query: string, caseSensitive: boolean): boolean => {
    if (source === null) {
        return false;
    }

    const normalizedSource = normalizeSearchText(source, caseSensitive);
    const normalizedQuery = normalizeSearchText(query, caseSensitive);
    return normalizedSource.includes(normalizedQuery);
};

/**
 * "(0010,0010)"
 * "0010,0010"
 * "00100010"
 *
 * 모두 "00100010"으로 변환한다.
 *
 * Tag 형태가 아니면 null.
 */
const normalizeTagQuery = (query: string): string | null => {
    const normalized = query.trim().replace(/[(),\s]/g, '').toUpperCase();
    if (!/^[0-9A-F]{8}$/.test(normalized)) {
        return null;
    }

    return normalized;
};

const normalizeSearchText = (value: string, caseSensitive: boolean): string => {
    const trimmed = value.trim();
    return caseSensitive ? trimmed : trimmed.toLocaleLowerCase();
};

export const dicomValueToSearchText = (value: NormalizedDicomValue): string | null => {
    if (value === null) {
        return null;
    }

    if (value instanceof Uint8Array) {
        return null;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
        return String(value);
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
        if ('group' in value && 'element' in value && typeof value.group === 'number' && typeof value.element === 'number') {
            const group = value.group.toString(16).toUpperCase().padStart(4, '0');
            const element = value.element.toString(16).toUpperCase().padStart(4, '0');
            return `(${group},${element})`;
        }

        return null;
    }

    if (Array.isArray(value)) {
        const values = value.map(item => {
            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'bigint') {
                return String(item);
            }

            if (item instanceof Uint8Array) {
                return null;
            }

            if (typeof item === 'object'
                && item !== null
                && 'group' in item && 'element' in item
                && typeof item.group === 'number'
                && typeof item.element === 'number'
            ) {
                const group = item.group.toString(16).toUpperCase().padStart(4, '0');
                const element = item.element.toString(16).toUpperCase().padStart(4, '0');
                return `(${group},${element})`;
            }

            return null;
        }).filter((item): item is string => item !== null);

        return values.length > 0 ? values.join('\\') : null;
    }

    return null;
};

export const getMatchedSearchFields = (
    element: NormalizedDicomElement,
    query: string,
    fields: readonly DicomSearchField[],
    caseSensitive: boolean
): DicomSearchField[] => {
    const matches: DicomSearchField[] = [];
    const tagQuery = normalizeTagQuery(query);

    for (const field of fields) {
        switch (field) {
            case 'tag': {
                if (tagQuery !== null && element.tag === tagQuery) {
                    matches.push('tag');
                }

                break;
            }
            case 'keyword': {
                if (includesSearchText(element.keyword, query, caseSensitive)) {
                    matches.push('keyword');
                }

                break;
            }
            case 'name': {
                if (includesSearchText(element.name, query, caseSensitive)) {
                    matches.push('name');
                }

                break;
            }
            case 'value': {
                const valueText = dicomValueToSearchText(element.value);
                if (includesSearchText(valueText, query, caseSensitive)) {
                    matches.push('value');
                }

                break;
            }
            case 'vr': {
                if (includesSearchText(element.vr, query, caseSensitive)) {
                    matches.push('vr');
                }

                break;
            }
        }
    }

    return matches;
};
