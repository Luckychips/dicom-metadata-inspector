import type {DicomSearchPathSegment} from "@/cores";

export const getFileSize = (data: File | number): string => {
    let size = 0;
    if (data instanceof Number) {
        size = data as unknown as number;
    } else if (data instanceof File) {
        size = data.size;
    }

    if (size < 1024) return `${size} B`;

    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const getFullTags = (path: readonly DicomSearchPathSegment[]): string => {
    if (path.length === 0) {
        return '-';
    }

    return path.map(segment => {
        const name = segment.keyword ?? segment.tag;
        return (`${name}` + `[${segment.itemIndex}]`);
    }).join(' > ');
};
