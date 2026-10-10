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
} from '@/cores';
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

    // ------------------------------------------
    // Implicit VR Little Endian
    // ------------------------------------------
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

    // ------------------------------------------
    // Explicit VR Little Endian
    // ------------------------------------------
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

    // ------------------------------------------
    // Explicit VR Big Endian
    //
    // Retired이지만 Metadata Inspector에서는
    // 구조 파싱 가능
    // ------------------------------------------
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

    // ------------------------------------------
    // Deflated Explicit VR Little Endian
    //
    // Dataset 자체가 deflate되어 있기 때문에
    // 현재 Binary Reader만으로 바로 파싱 불가능
    // ------------------------------------------
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

    // ------------------------------------------
    // JPEG / JPEG-LS / JPEG2000 / HTJ2K / RLE
    //
    // Dataset metadata는 Explicit VR LE로
    // 파싱 가능.
    //
    // Pixel Data decoding만 현재 미지원.
    // ------------------------------------------
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

    // ------------------------------------------
    // Unknown
    // ------------------------------------------
    return {
        uid: normalized,
        kind: 'unknown',
        /**
         * 알 수 없는 Transfer Syntax에 대해
         * 임의로 Explicit VR LE라고 가정하지 않는다.
         */
        explicitVR: false,
        littleEndian: true,
        encapsulated: false,
        metadataSupported: false,
        pixelDataDecodingSupported: false,
    };
};
