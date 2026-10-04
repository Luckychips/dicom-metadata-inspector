import {
    createBinaryContext,
    createDicomParseError,
    parseDataset,
    parseFileMeta,
    readAscii,
    readFileBuffer,
    resolveTransferSyntax,
} from '@/cores';
import { DICOM_PREFIX, DICOM_PREFIX_OFFSET } from '@/cores';
import type { ParseDatasetOptions, ParsedDicomFile } from '@/cores';

export const parseDicomBuffer = (buffer: ArrayBuffer, options: ParseDatasetOptions = {}): ParsedDicomFile => {
    /**
     * 128 preamble + DICM = 최소 132 bytes
     */
    if (buffer.byteLength < 132) {
        throw createDicomParseError('INVALID_PART10', 'File is too small to contain a DICOM Part 10 header');
    }

    const prefixContext = createBinaryContext(buffer, 'LE');
    const prefix = readAscii(prefixContext, DICOM_PREFIX_OFFSET, 4).value;
    if (prefix !== DICOM_PREFIX) {
        throw createDicomParseError(
            'INVALID_PREFIX',
            `Expected DICM prefix but found '${prefix}'`,
            DICOM_PREFIX_OFFSET
        );
    }

    // ----------------------------
    // File Meta
    // ----------------------------

    const fileMeta = parseFileMeta(buffer);
    if (!fileMeta.transferSyntaxUID) {
        throw createDicomParseError('MISSING_TRANSFER_SYNTAX', 'Transfer Syntax UID (0002,0010) was not found');
    }

    // ----------------------------
    // Transfer Syntax
    // ----------------------------

    const transferSyntax = resolveTransferSyntax(fileMeta.transferSyntaxUID);
    if (!transferSyntax.supported) {
        throw createDicomParseError(
            'UNSUPPORTED_TRANSFER_SYNTAX',
            `Unsupported Transfer Syntax: ${transferSyntax.uid}`,
            fileMeta.datasetOffset
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
