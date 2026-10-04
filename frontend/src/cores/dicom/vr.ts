import type { DicomVR } from './types';

const VALID_VRS = new Set<DicomVR>([
    'AE', 'AS', 'AT', 'CS', 'DA', 'DS', 'DT', 'FD', 'FL', 'IS', 'LO', 'LT',
    'OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'PN', 'SH', 'SL', 'SQ', 'SS', 'ST',
    'SV', 'TM', 'UC', 'UI', 'UL', 'UN', 'UR', 'US', 'UT', 'UV',
]);

/**
 * Explicit VR에서
 *
 * VR + Reserved(2) + 32-bit VL
 *
 * 구조를 사용하는 VR.
 */
const LONG_VALUE_LENGTH_VRS = new Set<DicomVR>(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT', 'SV', 'UV']);

export const isDicomVR = (value: string): value is DicomVR => VALID_VRS.has(value as DicomVR);
export const usesLongValueLength = (vr: DicomVR): boolean => LONG_VALUE_LENGTH_VRS.has(vr);
