import {
    readAscii,
    readUint16,
    readUint32,
    type BinaryContext,
} from '@/cores';
import { createDicomParseError } from './errors';
import { isDicomVR, usesLongValueLength } from './vr';
import type { DicomElementHeader } from './types';
import { UNDEFINED_LENGTH } from './constants';

export interface ElementHeaderOptions {
    explicitVR: boolean;
}

export const parseElementHeader = (
    context: BinaryContext,
    offset: number,
    options: ElementHeaderOptions
): DicomElementHeader => {
    const groupResult = readUint16(context, offset);
    const elementResult = readUint16(context, groupResult.nextOffset);
    const tag = { group: groupResult.value, element: elementResult.value };
    const afterTag = elementResult.nextOffset;

    // -----------------------------
    // Implicit VR
    // -----------------------------
    if (!options.explicitVR) {
        const lengthResult = readUint32(context, afterTag);
        return {
            tag,
            vr: null,
            valueLength: lengthResult.value,
            undefinedLength: lengthResult.value === UNDEFINED_LENGTH,
            offset,
            valueOffset: lengthResult.nextOffset,
            headerLength: lengthResult.nextOffset - offset,
        };
    }

    // -----------------------------
    // Explicit VR
    // -----------------------------
    const vrResult = readAscii(context, afterTag, 2);
    if (!isDicomVR(vrResult.value)) {
        throw createDicomParseError(
            'INVALID_VR',
            `Invalid VR '${vrResult.value}'`,
            afterTag
        );
    }

    const vr = vrResult.value;

    // -----------------------------
    // 32-bit Value Length VR
    // -----------------------------

    if (usesLongValueLength(vr)) {
        // VR 다음 2바이트는 Reserved
        const reservedOffset = vrResult.nextOffset;
        // Reserved 2 bytes 건너뛰기
        const lengthOffset = reservedOffset + 2;
        const lengthResult = readUint32(context, lengthOffset);
        return {
            tag,
            vr,
            valueLength: lengthResult.value,
            undefinedLength: lengthResult.value === UNDEFINED_LENGTH,
            offset,
            valueOffset: lengthResult.nextOffset,
            headerLength: lengthResult.nextOffset - offset,
        };
    }

    // -----------------------------
    // 16-bit Value Length VR
    // -----------------------------

    const lengthResult = readUint16(context, vrResult.nextOffset);

    return {
        tag,
        vr,
        valueLength: lengthResult.value,
        undefinedLength: false,
        offset,
        valueOffset: lengthResult.nextOffset,
        headerLength: lengthResult.nextOffset - offset,
    };
};
