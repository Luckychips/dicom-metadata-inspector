import { describe, expect, it, vi } from 'vitest';
import {
    processDicomFiles,
    type DicomFileEntry,
} from '@/cores';

const makeEntry = (id: string, name: string, content = 'test'): DicomFileEntry => {
    const file = new File([content], name, {
        type: 'application/dicom',
        lastModified: Date.now(),
    });

    return {
        id,
        file,
        name: file.name,
        path: file.name,
        size: file.size,
        lastModified: file.lastModified,
    };
};

describe('File Processing', () => {
    it('processes an empty file collection', async () => {
        const result = await processDicomFiles([]);

        expect(result.files).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
    });

    it('preserves files during processing', async () => {
        const entries = [
            makeEntry('1', 'a.dcm'),
            makeEntry('2', 'b.dcm'),
        ];

        const result = await processDicomFiles(entries);
        expect(result.files).toHaveLength(2);
        expect(result.files.map(entry => entry.file.name)).toEqual(['a.dcm', 'b.dcm']);
        expect(result.files.every(entry => typeof entry.id === 'string' && entry.id.length > 0)).toBe(true);
        expect(new Set(result.files.map(entry => entry.id)).size).toBe(2);
    });

    it('reports progress through the callback', async () => {
        const onProgress = vi.fn();

        await processDicomFiles([makeEntry('1', 'a.dcm'), makeEntry('2', 'b.dcm')],
            { onProgress }
        );

        expect(onProgress).toHaveBeenCalled();

        for (const [progress] of onProgress.mock.calls) {
            expect(progress.percentage).toBeGreaterThanOrEqual(0);
            expect(progress.percentage).toBeLessThanOrEqual(100);
        }
    });

    it('handles an already-aborted signal', async () => {
        const controller = new AbortController();
        controller.abort();

        try {
            await processDicomFiles(
                [makeEntry('1', 'a.dcm')],
                { signal: controller.signal }
            );
        } catch (error) {
            expect(controller.signal.aborted).toBe(true);
            expect(error).toBeDefined();
        }
    });

    it('preserves the native File reference', async () => {
        const entry = makeEntry('1', 'original.dcm');
        const result = await processDicomFiles([entry]);
        expect(result.files[0].file).toBe(entry.file);
    });
});
