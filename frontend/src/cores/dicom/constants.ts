export const DICOM_PREFIX_OFFSET = 128;
export const DICOM_PREFIX = 'DICM';
export const DICOM_DATASET_OFFSET = 132;

export const UNDEFINED_LENGTH = 0xffffffff;

export const FILE_META_GROUP = 0x0002;

/**
 * Sequence Item
 *
 * (FFFE,E000)
 */
export const ITEM_GROUP = 0xfffe;

export const ITEM_ELEMENT = 0xe000;

/**
 * Item Delimitation
 *
 * (FFFE,E00D)
 */
export const ITEM_DELIMITATION_ELEMENT = 0xe00d;

/**
 * Sequence Delimitation
 *
 * (FFFE,E0DD)
 */
export const SEQUENCE_DELIMITATION_ELEMENT = 0xe0dd;

/**
 * Pixel Data
 *
 * (7FE0,0010)
 */
export const PIXEL_DATA_GROUP = 0x7fe0;

export const PIXEL_DATA_ELEMENT = 0x0010;

export const TRANSFER_SYNTAX_UID_TAG = {
    group: 0x0002,
    element: 0x0010,
} as const;

export const PIXEL_DATA_TAG = {
    group: 0x7fe0,
    element: 0x0010,
} as const;

export const ITEM_TAG = {
    group: 0xfffe,
    element: 0xe000,
} as const;

export const ITEM_DELIMITATION_TAG = {
    group: 0xfffe,
    element: 0xe00d,
} as const;

export const SEQUENCE_DELIMITATION_TAG = {
    group: 0xfffe,
    element: 0xe0dd,
} as const;

// --------------------------------------------------
// Native Transfer Syntax
// --------------------------------------------------
export const IMPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2';
export const EXPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2.1';
export const DEFLATED_EXPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2.1.99';
export const EXPLICIT_VR_BIG_ENDIAN = '1.2.840.10008.1.2.2';

// --------------------------------------------------
// RLE
// --------------------------------------------------
export const RLE_LOSSLESS = '1.2.840.10008.1.2.5';

// --------------------------------------------------
// JPEG
// --------------------------------------------------
export const JPEG_BASELINE_8_BIT = '1.2.840.10008.1.2.4.50';
export const JPEG_EXTENDED_12_BIT = '1.2.840.10008.1.2.4.51';
export const JPEG_LOSSLESS_NON_HIERARCHICAL = '1.2.840.10008.1.2.4.57';
export const JPEG_LOSSLESS_NON_HIERARCHICAL_FIRST_ORDER = '1.2.840.10008.1.2.4.70';

// --------------------------------------------------
// JPEG-LS
// --------------------------------------------------
export const JPEG_LS_LOSSLESS = '1.2.840.10008.1.2.4.80';
export const JPEG_LS_NEAR_LOSSLESS = '1.2.840.10008.1.2.4.81';

// --------------------------------------------------
// JPEG 2000
// --------------------------------------------------\
export const JPEG_2000_LOSSLESS = '1.2.840.10008.1.2.4.90';
export const JPEG_2000 = '1.2.840.10008.1.2.4.91';

// --------------------------------------------------
// HTJ2K
// --------------------------------------------------
export const HTJ2K_LOSSLESS = '1.2.840.10008.1.2.4.201';
export const HTJ2K_LOSSLESS_RPCL = '1.2.840.10008.1.2.4.202';
export const HTJ2K = '1.2.840.10008.1.2.4.203';
