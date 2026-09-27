import type { CollectedFile } from './types';

export const createFileKey = (entry: CollectedFile): string => {
    const { file, path } = entry;

    return JSON.stringify([path, file.size, file.lastModified]);
};

export const isDuplicate = (entry: CollectedFile, existingKeys: ReadonlySet<string>): boolean => {
    return existingKeys.has(createFileKey(entry));
};
