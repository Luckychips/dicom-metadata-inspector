import type { DicomVR, DicomDecodedValue, TransferSyntax } from '@/cores';

/**
 * 정규화된 Element의 값.
 *
 * 일반 Element는 FR-05의 DecodedValue를 사용하고,
 * SQ는 별도의 items 필드로 표현한다.
 */
export type NormalizedDicomValue = DicomDecodedValue;

/**
 * 정규화된 Sequence Item
 */
export interface NormalizedDicomItem {
    index: number;
    elements: NormalizedDicomElement[];
}

/**
 * 정규화된 Data Element
 */
export interface NormalizedDicomElement {
    /**
     * 예: 00100010
     */
    tag: string;

    /**
     * 예: (0010,0010)
     */
    formattedTag: string;

    group: number;

    element: number;

    /**
     * DICOM Attribute Name
     */
    name: string | null;

    /**
     * DICOM Keyword
     */
    keyword: string | null;

    /**
     * 최종 VR
     */
    vr: DicomVR | null;

    /**
     * Dictionary VR 후보
     */
    dictionaryVR: readonly DicomVR[];

    /**
     * Value Multiplicity
     */
    vm: string | null;

    /**
     * 실제 Value
     */
    value: NormalizedDicomValue;

    /**
     * SQ일 경우 Item 목록
     */
    items: NormalizedDicomItem[] | null;

    /**
     * 원본 Value Length
     */
    valueLength: number;

    /**
     * Undefined Length 여부
     */
    undefinedLength: boolean;

    /**
     * Private Tag 여부
     */
    isPrivate: boolean;

    /**
     * Dictionary에 등록되어 있는지
     */
    isKnown: boolean;

    /**
     * Binary Value 여부
     */
    isBinary: boolean;

    /**
     * 값이 실제로 디코딩되었는지
     */
    isDecoded: boolean;

    /**
     * Value가 원본에 존재하지만
     * Parser에서 보관하지 않은 경우
     */
    isValueOmitted: boolean;
}

/**
 * 정규화된 Dataset
 */
export interface NormalizedDicomDataset {
    elements: NormalizedDicomElement[];
    elementCount: number;

    /**
     * SQ 내부 Element까지 포함
     */
    totalElementCount: number;
    stoppedEarly: boolean;
    stopReason?: string;
}

/**
 * 주요 DICOM Metadata
 */
export interface NormalizedDicomSummary {
    patientName: string | null;
    patientID: string | null;
    studyInstanceUID: string | null;
    seriesInstanceUID: string | null;
    sopInstanceUID: string | null;
    sopClassUID: string | null;
    modality: string | null;
    studyDate: string | null;
    studyTime: string | null;
    studyDescription: string | null;
    seriesDescription: string | null;
    seriesNumber: number | null;
    instanceNumber: number | null;
    rows: number | null;
    columns: number | null;
}

/**
 * Character Set 상태
 *
 * FR-08에서는 문자셋을 식별하지만
 * ISO 2022의 완전한 디코딩까지 구현하지 않는다.
 */
export interface NormalizedCharacterSet {
    values: string[];
    encoding: string | null;
    supported: boolean;
}

/**
 * 최종 정규화 결과
 */
export interface NormalizedDicomFile {
    isPart10: boolean;
    transferSyntax: TransferSyntax;
    characterSet: NormalizedCharacterSet;
    fileMeta: NormalizedDicomDataset;
    dataset: NormalizedDicomDataset;
    summary: NormalizedDicomSummary;
}
