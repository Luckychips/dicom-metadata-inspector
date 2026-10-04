import {
    EXPLICIT_VR_BIG_ENDIAN,
    EXPLICIT_VR_LITTLE_ENDIAN,
    IMPLICIT_VR_LITTLE_ENDIAN,
} from './constants';
import type { TransferSyntax } from './types';

const createUnsupportedSyntax = (uid: string): TransferSyntax => ({
    uid,
    kind: 'unsupported',
    explicitVR: true,
    littleEndian: true,
    encapsulated: true,
    supported: false,
});

export const resolveTransferSyntax = (uid: string): TransferSyntax => {
    switch (uid) {
        case IMPLICIT_VR_LITTLE_ENDIAN:
            return {
                uid,
                kind: 'implicit-vr-little-endian',
                explicitVR: false,
                littleEndian: true,
                encapsulated: false,
                supported: true,
            };

        case EXPLICIT_VR_LITTLE_ENDIAN:
            return {
                uid,
                kind: 'explicit-vr-little-endian',
                explicitVR: true,
                littleEndian: true,
                encapsulated: false,
                supported: true,
            };

        case EXPLICIT_VR_BIG_ENDIAN:
            return {
                uid,
                kind: 'explicit-vr-big-endian',
                explicitVR: true,
                littleEndian: false,
                encapsulated: false,
                supported: true,
            };

        default:
            /**
             * JPEG/JPEG-LS/JPEG2000/RLE 등의
             * 압축 Transfer Syntax는 FR-03에서
             * Pixel Data decoding 대상이 아님.
             *
             * 다만 대부분 Dataset metadata 자체는
             * Explicit VR Little Endian 형태이므로
             * FR-04에서 세분화할 예정.
             */
            return createUnsupportedSyntax(uid);
    }
};
