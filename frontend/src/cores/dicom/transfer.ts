import {
    DEFLATED_EXPLICIT_VR_LITTLE_ENDIAN,
    EXPLICIT_VR_BIG_ENDIAN,
    EXPLICIT_VR_LITTLE_ENDIAN,
    HTJ2K,
    HTJ2K_LOSSLESS,
    HTJ2K_LOSSLESS_RPCL,
    IMPLICIT_VR_LITTLE_ENDIAN,
    JPEG_2000,
    JPEG_2000_LOSSLESS,
    JPEG_BASELINE_8_BIT,
    JPEG_EXTENDED_12_BIT,
    JPEG_LOSSLESS_NON_HIERARCHICAL,
    JPEG_LOSSLESS_NON_HIERARCHICAL_FIRST_ORDER,
    JPEG_LS_LOSSLESS,
    JPEG_LS_NEAR_LOSSLESS,
    RLE_LOSSLESS,
} from './_';
import type { TransferSyntax } from './types';

const ENCAPSULATED_TRANSFER_SYNTAX_UIDS = new Set<string>([
    JPEG_BASELINE_8_BIT,
    JPEG_EXTENDED_12_BIT,
    JPEG_LOSSLESS_NON_HIERARCHICAL,
    JPEG_LOSSLESS_NON_HIERARCHICAL_FIRST_ORDER,
    JPEG_LS_LOSSLESS,
    JPEG_LS_NEAR_LOSSLESS,
    JPEG_2000_LOSSLESS,
    JPEG_2000,
    HTJ2K_LOSSLESS,
    HTJ2K_LOSSLESS_RPCL,
    HTJ2K,
    RLE_LOSSLESS,
]);

const normalizeTransferSyntaxUID = (uid: string): string => {
    return uid.replace(/\0/g, '').trim();
};

export const isEncapsulatedTransferSyntax = (uid: string): boolean => {
    const normalized = normalizeTransferSyntaxUID(uid);
    return ENCAPSULATED_TRANSFER_SYNTAX_UIDS.has(normalized);
};

export const resolveTransferSyntax = (uid: string): TransferSyntax => {
    const normalized = normalizeTransferSyntaxUID(uid);


    // console.log('[Transfer Syntax]', {
    //     uid,
    //     normalized,
    //     jpegUID: JPEG_BASELINE_8_BIT,
    //     rleUID: RLE_LOSSLESS,
    //     matched: ENCAPSULATED_TRANSFER_SYNTAX_UIDS.has(normalized),
    // });

    console.log('[Encapsulated UID Set]', {
        size: ENCAPSULATED_TRANSFER_SYNTAX_UIDS.size,
        values: [...ENCAPSULATED_TRANSFER_SYNTAX_UIDS],
        jpegIncluded: ENCAPSULATED_TRANSFER_SYNTAX_UIDS.has(
            JPEG_BASELINE_8_BIT
        ),
        rleIncluded: ENCAPSULATED_TRANSFER_SYNTAX_UIDS.has(
            RLE_LOSSLESS
        ),
    });


    if (normalized === IMPLICIT_VR_LITTLE_ENDIAN) {
        return {
            uid: normalized,
            kind: 'implicit-vr-little-endian',
            explicitVR: false,
            littleEndian: true,
            encapsulated: false,
            metadataSupported: true,
            pixelDataDecodingSupported: false,
        };
    }

    if (normalized === EXPLICIT_VR_LITTLE_ENDIAN) {
        return {
            uid: normalized,
            kind: 'explicit-vr-little-endian',
            explicitVR: true,
            littleEndian: true,
            encapsulated: false,
            metadataSupported: true,
            pixelDataDecodingSupported: false,
        };
    }

    if (normalized === EXPLICIT_VR_BIG_ENDIAN) {
        return {
            uid: normalized,
            kind: 'explicit-vr-big-endian',
            explicitVR: true,
            littleEndian: false,
            encapsulated: false,
            metadataSupported: true,
            pixelDataDecodingSupported: false,
        };
    }

    if (normalized === DEFLATED_EXPLICIT_VR_LITTLE_ENDIAN) {
        return {
            uid: normalized,
            kind: 'deflated-explicit-vr-little-endian',
            explicitVR: true,
            littleEndian: true,
            encapsulated: false,
            metadataSupported: false,
            pixelDataDecodingSupported: false,
        };
    }

    if (ENCAPSULATED_TRANSFER_SYNTAX_UIDS.has(normalized)) {
        return {
            uid: normalized,
            kind: 'encapsulated-explicit-vr-little-endian',
            explicitVR: true,
            littleEndian: true,
            encapsulated: true,
            metadataSupported: true,
            pixelDataDecodingSupported: false,
        };
    }

    return {
        uid: normalized,
        kind: 'unknown',
        explicitVR: false,
        littleEndian: true,
        encapsulated: false,
        metadataSupported: false,
        pixelDataDecodingSupported: false,
    };
};
