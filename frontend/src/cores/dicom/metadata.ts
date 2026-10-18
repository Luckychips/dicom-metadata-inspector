import type { FileMetaElement, FileMetaInformation } from './types';
import {
    DICOM_DATASET_OFFSET,
    FILE_META_GROUP,
    TRANSFER_SYNTAX_UID_TAG,
    createBinaryContext,
    parseElementHeader,
    readBytes,
} from '@/cores';

const decodeUI = (bytes: Uint8Array): string => {
    const value = new TextDecoder("ascii").decode(bytes);

    // UI VR padding은 NULL 또는 space 가능성을
    // 방어적으로 제거
    return value.replace(/[\0 ]+$/g, '');
};

const isTransferSyntaxTag = (group: number, element: number): boolean =>
    group === TRANSFER_SYNTAX_UID_TAG.group && element === TRANSFER_SYNTAX_UID_TAG.element;

export const parseFileMeta = (buffer: ArrayBuffer): FileMetaInformation => {
    const context = createBinaryContext(buffer, 'LE');
    let offset = DICOM_DATASET_OFFSET;
    const elements: FileMetaElement[] = [];
    let transferSyntaxUID: string | null = null;

    while (offset + 4 <= context.view.byteLength) {
        const group = context.view.getUint16(offset, true);
        if (group !== FILE_META_GROUP) {
            break;
        }

        const header = parseElementHeader(context, offset, { explicitVR: true });
        if (header.undefinedLength) {
            throw new Error(`Undefined length is invalid in File Meta at offset ${offset}`);
        }

        const valueEnd = header.valueOffset + header.valueLength;
        if (valueEnd > context.view.byteLength) {
            throw new RangeError(`File Meta value exceeds buffer: offset=${header.valueOffset}, length=${header.valueLength}`);
        }

        const rawValue = readBytes(context, header.valueOffset, header.valueLength).value;
        const metaElement: FileMetaElement = {
            ...header,
            rawValue,
        };

        elements.push(metaElement);

        if (isTransferSyntaxTag(header.tag.group, header.tag.element)) {
            transferSyntaxUID = decodeUI(rawValue);
        }

        offset = valueEnd;
    }

    return {
        elements,
        transferSyntaxUID,
        datasetOffset: offset,
    };
};
