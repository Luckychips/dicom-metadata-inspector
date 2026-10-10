import type {
    DicomDictionaryEntry,
    DicomTag,
    DicomVR,
    ResolvedDicomVR,
} from './types';

/**
 * Tag를 Dictionary Key로 변환한다.
 *
 * 예:
 *
 * (0010,0010)
 *      ↓
 * "00100010"
 */
export const createTagKey = (group: number, element: number): string => {
    return (
        group.toString(16).padStart(4, '0') +
        element.toString(16).padStart(4, '0')
    ).toUpperCase();
};

/**
 * Private Tag 여부
 *
 * DICOM에서는 Group Number가 홀수이면
 * Private Group이다.
 */
export const isPrivateTag = (group: number): boolean => {
    return (group & 1) === 1;
};

/**
 * Standard DICOM Dictionary
 *
 * 현재 Metadata Inspector에서 필요한
 * 주요 Attribute부터 정의한다.
 *
 * 전체 Dictionary는 추후 generated data로
 * 교체할 수 있다.
 */
const STANDARD_DICTIONARY: Readonly<Record<string, DicomDictionaryEntry>> = {
    '00020000': {
        name: 'File Meta Information Group Length',
        keyword: 'FileMetaInformationGroupLength',
        vr: ['UL'],
        vm: '1',
    },
    '00020001': {
        name: 'File Meta Information Version',
        keyword: 'FileMetaInformationVersion',
        vr: ['OB'],
        vm: '1',
    },
    '00020002': {
        name: 'Media Storage SOP Class UID',
        keyword: 'MediaStorageSOPClassUID',
        vr: ['UI'],
        vm: '1',
    },
    '00020003': {
        name: 'Media Storage SOP Instance UID',
        keyword: 'MediaStorageSOPInstanceUID',
        vr: ['UI'],
        vm: '1',
    },
    '00020010': {
        name: 'Transfer Syntax UID',
        keyword: 'TransferSyntaxUID',
        vr: ['UI'],
        vm: '1',
    },
    '00020012': {
        name: 'Implementation Class UID',
        keyword: 'ImplementationClassUID',
        vr: ['UI'],
        vm: '1',
    },
    '00020013': {
        name: 'Implementation Version Name',
        keyword: 'ImplementationVersionName',
        vr: ['SH'],
        vm: '1',
    },
    '00080005': {
        name: 'Specific Character Set',
        keyword: 'SpecificCharacterSet',
        vr: ['CS'],
        vm: '1-n',
    },
    '00080008': {
        name: 'Image Type',
        keyword: 'ImageType',
        vr: ['CS'],
        vm: '2-n',
    },
    '00080016': {
        name: 'SOP Class UID',
        keyword: 'SOPClassUID',
        vr: ['UI'],
        vm: '1',
    },
    '00080018': {
        name: 'SOP Instance UID',
        keyword: 'SOPInstanceUID',
        vr: ['UI'],
        vm: '1',
    },
    '00080020': {
        name: 'Study Date',
        keyword: 'StudyDate',
        vr: ['DA'],
        vm: '1',
    },
    '00080021': {
        name: 'Series Date',
        keyword: 'SeriesDate',
        vr: ['DA'],
        vm: '1',
    },
    '00080022': {
        name: 'Acquisition Date',
        keyword: 'AcquisitionDate',
        vr: ['DA'],
        vm: '1',
    },
    '00080023': {
        name: 'Content Date',
        keyword: 'ContentDate',
        vr: ['DA'],
        vm: '1',
    },
    '00080030': {
        name: 'Study Time',
        keyword: 'StudyTime',
        vr: ['TM'],
        vm: '1',
    },
    '00080031': {
        name: 'Series Time',
        keyword: 'SeriesTime',
        vr: ['TM'],
        vm: '1',
    },
    '00080032': {
        name: 'Acquisition Time',
        keyword: 'AcquisitionTime',
        vr: ['TM'],
        vm: '1',
    },
    '00080033': {
        name: 'Content Time',
        keyword: 'ContentTime',
        vr: ['TM'],
        vm: '1',
    },
    '00080050': {
        name: 'Accession Number',
        keyword: 'AccessionNumber',
        vr: ['SH'],
        vm: '1',
    },
    '00080060': {
        name: 'Modality',
        keyword: 'Modality',
        vr: ['CS'],
        vm: '1',
    },
    '00080070': {
        name: 'Manufacturer',
        keyword: 'Manufacturer',
        vr: ['LO'],
        vm: '1',
    },
    '00080080': {
        name: 'Institution Name',
        keyword: 'InstitutionName',
        vr: ['LO'],
        vm: '1',
    },
    '00080090': {
        name: "Referring Physician's Name",
        keyword: 'ReferringPhysicianName',
        vr: ['PN'],
        vm: '1',
    },
    '00081030': {
        name: 'Study Description',
        keyword: 'StudyDescription',
        vr: ['LO'],
        vm: '1',
    },
    '0008103E': {
        name: 'Series Description',
        keyword: 'SeriesDescription',
        vr: ['LO'],
        vm: '1',
    },
    '00081110': {
        name: 'Referenced Study Sequence',
        keyword: 'ReferencedStudySequence',
        vr: ['SQ'],
        vm: '1',
    },
    '00081115': {
        name: 'Referenced Series Sequence',
        keyword: 'ReferencedSeriesSequence',
        vr: ['SQ'],
        vm: '1',
    },
    '00081140': {
        name: 'Referenced Image Sequence',
        keyword: 'ReferencedImageSequence',
        vr: ['SQ'],
        vm: '1',
    },
    '00081150': {
        name: 'Referenced SOP Class UID',
        keyword: 'ReferencedSOPClassUID',
        vr: ['UI'],
        vm: '1',
    },
    '00081155': {
        name: 'Referenced SOP Instance UID',
        keyword: 'ReferencedSOPInstanceUID',
        vr: ['UI'],
        vm: '1',
    },
    '00100010': {
        name: "Patient's Name",
        keyword: 'PatientName',
        vr: ['PN'],
        vm: '1',
    },
    '00100020': {
        name: 'Patient ID',
        keyword: 'PatientID',
        vr: ['LO'],
        vm: '1',
    },
    '00100030': {
        name: "Patient's Birth Date",
        keyword: 'PatientBirthDate',
        vr: ['DA'],
        vm: '1',
    },
    '00100040': {
        name: "Patient's Sex",
        keyword: 'PatientSex',
        vr: ['CS'],
        vm: '1',
    },
    '00180050': {
        name: 'Slice Thickness',
        keyword: 'SliceThickness',
        vr: ['DS'],
        vm: '1',
    },
    '00180080': {
        name: 'Repetition Time',
        keyword: 'RepetitionTime',
        vr: ['DS'],
        vm: '1',
    },
    '00180081': {
        name: 'Echo Time',
        keyword: 'EchoTime',
        vr: ['DS'],
        vm: '1',
    },
    '00181030': {
        name: 'Protocol Name',
        keyword: 'ProtocolName',
        vr: ['LO'],
        vm: '1',
    },
    '0020000D': {
        name: 'Study Instance UID',
        keyword: 'StudyInstanceUID',
        vr: ['UI'],
        vm: '1',
    },
    '0020000E': {
        name: 'Series Instance UID',
        keyword: 'SeriesInstanceUID',
        vr: ['UI'],
        vm: '1',
    },
    '00200010': {
        name: 'Study ID',
        keyword: 'StudyID',
        vr: ['SH'],
        vm: '1',
    },
    '00200011': {
        name: 'Series Number',
        keyword: 'SeriesNumber',
        vr: ['IS'],
        vm: '1',
    },
    '00200013': {
        name: 'Instance Number',
        keyword: 'InstanceNumber',
        vr: ['IS'],
        vm: '1',
    },
    '00200032': {
        name: 'Image Position (Patient)',
        keyword: 'ImagePositionPatient',
        vr: ['DS'],
        vm: '3',
    },
    '00200037': {
        name: 'Image Orientation (Patient)',
        keyword: 'ImageOrientationPatient',
        vr: ['DS'],
        vm: '6',
    },
    '00200052': {
        name: 'Frame of Reference UID',
        keyword: 'FrameOfReferenceUID',
        vr: ['UI'],
        vm: '1',
    },
    '00280002': {
        name: 'Samples per Pixel',
        keyword: 'SamplesPerPixel',
        vr: ['US'],
        vm: '1',
    },
    '00280004': {
        name: 'Photometric Interpretation',
        keyword: 'PhotometricInterpretation',
        vr: ['CS'],
        vm: '1',
    },
    '00280008': {
        name: 'Number of Frames',
        keyword: 'NumberOfFrames',
        vr: ['IS'],
        vm: '1',
    },
    '00280010': {
        name: 'Rows',
        keyword: 'Rows',
        vr: ['US'],
        vm: '1',
    },
    '00280011': {
        name: 'Columns',
        keyword: 'Columns',
        vr: ['US'],
        vm: '1',
    },
    '00280030': {
        name: 'Pixel Spacing',
        keyword: 'PixelSpacing',
        vr: ['DS'],
        vm: '2',
    },
    '00280100': {
        name: 'Bits Allocated',
        keyword: 'BitsAllocated',
        vr: ['US'],
        vm: '1',
    },
    '00280101': {
        name: 'Bits Stored',
        keyword: 'BitsStored',
        vr: ['US'],
        vm: '1',
    },
    '00280102': {
        name: 'High Bit',
        keyword: 'HighBit',
        vr: ['US'],
        vm: '1',
    },
    '00280103': {
        name: 'Pixel Representation',
        keyword: 'PixelRepresentation',
        vr: ['US'],
        vm: '1',
    },
    '00281050': {
        name: 'Window Center',
        keyword: 'WindowCenter',
        vr: ['DS'],
        vm: '1-n',
    },
    '00281051': {
        name: 'Window Width',
        keyword: 'WindowWidth',
        vr: ['DS'],
        vm: '1-n',
    },
    '00281052': {
        name: 'Rescale Intercept',
        keyword: 'RescaleIntercept',
        vr: ['DS'],
        vm: '1',
    },
    '00281053': {
        name: 'Rescale Slope',
        keyword: 'RescaleSlope',
        vr: ['DS'],
        vm: '1',
    },
    '7FE00010': {
        name: 'Pixel Data',
        keyword: 'PixelData',
        vr: ['OB', 'OW'],
        vm: '1',
    },
};
export const getDictionaryEntry = (group: number, element: number
): DicomDictionaryEntry | null => {
    const key = createTagKey(group, element);
    return (STANDARD_DICTIONARY[key] ?? null);
};

export const getDictionaryEntryByTag = (tag: DicomTag): DicomDictionaryEntry | null => {
    return getDictionaryEntry(tag.group, tag.element);
};

export const getDictionaryVR = (group: number, element: number): DicomVR | null => {
    const entry = getDictionaryEntry(group, element);

    if (!entry) {
        return null;
    }

    if (entry.vr.length !== 1) {
        return null;
    }

    return entry.vr[0];
};

/**
 * Element의 실제 VR 결정.
 *
 * Explicit VR
 * → 파일 Header의 VR 우선
 *
 * Implicit VR
 * → Dictionary 조회
 */
export const resolveElementVR = (tag: DicomTag, explicitVR: DicomVR | null): ResolvedDicomVR => {
    const dictionaryEntry = getDictionaryEntryByTag(tag);

    /**
     * Explicit VR이면 파일에 기록된
     * VR을 우선한다.
     */
    if (explicitVR !== null) {
        return {
            vr: explicitVR,
            source: 'explicit',
            dictionaryEntry,
        };
    }

    /**
     * Implicit VR
     */
    if (dictionaryEntry && dictionaryEntry.vr.length === 1) {
        return {
            vr: dictionaryEntry.vr[0],
            source: 'dictionary',
            dictionaryEntry,
        };
    }

    return {
        vr: null,
        source: 'unknown',
        dictionaryEntry,
    };
};
