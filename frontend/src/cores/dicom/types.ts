export type DicomVR = | 'AE' | 'AS' | 'AT' | 'CS' | 'DA' | 'DS' | 'DT' | 'FD' | 'FL'
    | 'IS' | 'LO' | 'LT' | 'OB' | 'OD' | 'OF' | 'OL' | 'OV' | 'OW' | 'PN'
    | 'SH' | 'SL' | 'SQ' | 'SS' | 'ST' | 'SV' | 'TM'
    | 'UC' | 'UI' | 'UL' | 'UN' | 'UR' | 'US' | 'UT' | 'UV';

export type TransferSyntaxKind = | 'explicit-vr-little-endian' | 'implicit-vr-little-endian'
    | 'explicit-vr-big-endian' | 'unsupported';

export interface DicomTag {
    group: number;
    element: number;
}

export interface DicomElementHeader {
    tag: DicomTag;

    /**
     * Explicit VR에서는 파일에서 읽은 VR.
     * Implicit VR에서는 FR-07 Dictionary가 없으므로 null.
     */
    vr: DicomVR | null;

    /**
     * Value Length.
     * 0xFFFFFFFF이면 undefined length.
     */
    valueLength: number;

    undefinedLength: boolean;

    /**
     * Data Element 전체의 시작 위치
     */
    offset: number;

    /**
     * Value가 시작되는 위치
     */
    valueOffset: number;

    /**
     * header 자체의 byte 길이
     */
    headerLength: number;
}

export interface FileMetaElement extends DicomElementHeader {
    rawValue: Uint8Array;
}

export interface FileMetaInformation {
    elements: FileMetaElement[];

    transferSyntaxUID: string | null;

    /**
     * (0002,xxxx)가 끝나고 실제 Dataset이 시작되는 위치
     */
    datasetOffset: number;
}

export interface TransferSyntax {
    uid: string;
    kind: TransferSyntaxKind;

    explicitVR: boolean;
    littleEndian: boolean;

    /**
     * Pixel Data가 압축 Transfer Syntax일 가능성.
     * FR-03에서는 pixel decode를 하지 않음.
     */
    encapsulated: boolean;

    supported: boolean;
}

export interface ParsedDataElement extends DicomElementHeader {
    /**
     * FR-03에서는 raw bytes만 유지.
     * 실제 VR별 값 변환은 FR-05에서 수행.
     */
    rawValue: Uint8Array | null;
}

export interface ParsedDataset {
    elements: ParsedDataElement[];

    startOffset: number;
    endOffset: number;

    /**
     * FR-06이 필요한 구조를 만나 조기 종료했는지 여부.
     */
    stoppedEarly: boolean;

    stopReason?: string;
}

export interface ParsedDicomFile {
    isPart10: boolean;

    fileMeta: FileMetaInformation;

    transferSyntax: TransferSyntax;

    dataset: ParsedDataset;
}

export interface ParseDatasetOptions {
    /**
     * Pixel Data raw bytes를 메모리에 포함할지 여부.
     * 기본 false.
     */
    includePixelData?: boolean;

    /**
     * 비정상 파일에 의한 무한/과도한 순회를 방지.
     */
    maxElements?: number;
}
