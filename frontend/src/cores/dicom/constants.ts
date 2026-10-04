export const DICOM_PREFIX_OFFSET = 128;
export const DICOM_PREFIX = 'DICM';
export const DICOM_DATASET_OFFSET = 132;
export const UNDEFINED_LENGTH = 0xffffffff;
export const FILE_META_GROUP = 0x0002;
export const TRANSFER_SYNTAX_UID_TAG = {
    group: 0x0002,
    element: 0x0010,
} as const;

export const PIXEL_DATA_TAG = {
    group: 0x7fe0,
    element: 0x0010,
} as const;

// Sequence / Item 관련 특수 태그
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

// Transfer Syntax UID
export const IMPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2';
export const EXPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2.1';
export const EXPLICIT_VR_BIG_ENDIAN = '1.2.840.10008.1.2.2';
