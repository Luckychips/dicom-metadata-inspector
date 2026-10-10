import {
    createBinaryContext,
    createDicomParseError,
    parseDataset,
    parseFileMeta,
    readAscii,
    readFileBuffer,
    resolveTransferSyntax,
} from '@/cores';
import { DICOM_DATASET_OFFSET, DICOM_PREFIX, DICOM_PREFIX_OFFSET } from '@/cores';
import type { ParseDatasetOptions, ParsedDicomFile } from '@/cores';

export const parseDicomBuffer = (buffer: ArrayBuffer, options: ParseDatasetOptions = {}): ParsedDicomFile => {
    if (buffer.byteLength < DICOM_DATASET_OFFSET) {
        throw createDicomParseError('INVALID_PART10', 'File is too small to be a DICOM Part 10 file');
    }

    const context = createBinaryContext(buffer, 'LE');
    const prefix = readAscii(context, DICOM_PREFIX_OFFSET, 4).value;
    if (prefix !== DICOM_PREFIX) {
        throw createDicomParseError(
            'INVALID_PREFIX',
            'DICOM Part 10 prefix DICM was not found',
            DICOM_PREFIX_OFFSET
        );
    }

    // ----------------------------
    // File Meta
    // ----------------------------
    const fileMeta = parseFileMeta(buffer);
    if (!fileMeta.transferSyntaxUID) {
        throw createDicomParseError('MISSING_TRANSFER_SYNTAX', 'Transfer Syntax UID was not found in File Meta Information');
    }

    // ----------------------------
    // Transfer Syntax
    // ----------------------------
    const transferSyntax = resolveTransferSyntax(fileMeta.transferSyntaxUID);
    if (!transferSyntax.metadataSupported) {
        throw createDicomParseError(
            'UNSUPPORTED_TRANSFER_SYNTAX',
            `Unsupported Transfer Syntax for metadata parsing: ${transferSyntax.uid}`
        );
    }

    // ----------------------------
    // Dataset
    // ----------------------------
    const dataset = parseDataset(buffer, fileMeta.datasetOffset, transferSyntax, options);
    return {
        isPart10: true,
        fileMeta,
        transferSyntax,
        dataset,
    };
};

export const parseDicomFile = async (file: File, options: ParseDatasetOptions = {}, signal?: AbortSignal): Promise<ParsedDicomFile> => {
    const buffer = await readFileBuffer(file, signal);

    signal?.throwIfAborted();

    const result = parseDicomBuffer(buffer, options);

    signal?.throwIfAborted();

    return result;
};
