import type {
    DecodedDicomTag,
    DecodeValueOptions,
    DicomDecodedValue,
    DicomPrimitiveValue,
    DicomVR,
    ParsedDataElement,
    TransferSyntax,
} from './types';

/**
 * DICOM text padding은 VR에 따라 SPACE 또는 NULL을
 * 사용할 수 있다.
 *
 * 여기서는 value 뒤쪽의 padding만 제거한다.
 */
const trimTextPadding = (value: string): string => {
    return value.replace(/[\0 ]+$/g, '');
};

/**
 * UI는 NULL padding을 사용할 수 있으므로
 * 별도로 처리한다.
 */
const trimUIPadding = (value: string): string => {
    return value.replace(/\0+$/g, '').trim();
};

const decodeText = (bytes: Uint8Array, encoding = 'utf-8'): string => {
    if (bytes.length === 0) {
        return '';
    }

    const decoder = new TextDecoder(encoding, {
        fatal: false,
    });

    return decoder.decode(bytes);
};

const splitMultiValue = (value: string): string[] => {
    return value.split('\\');
};

const collapseSingleValue = <T>(values: T[]): T | T[] | null => {
    if (values.length === 0) {
        return null;
    }

    if (values.length === 1) {
        return values[0];
    }

    return values;
};

const createDataView = (bytes: Uint8Array): DataView => {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
};

// --------------------------------------------------
// Text VR
// --------------------------------------------------
const decodeSingleTextValue = (bytes: Uint8Array, encoding?: string): string => {
    return trimTextPadding(decodeText(bytes, encoding));
};

const decodeMultiTextValue = (bytes: Uint8Array, encoding?: string): DicomDecodedValue => {
    const text = decodeSingleTextValue(bytes, encoding);
    const values = splitMultiValue(text);

    return collapseSingleValue(values);
};

// --------------------------------------------------
// UI
// --------------------------------------------------
const decodeUIValue = (bytes: Uint8Array): DicomDecodedValue => {
    const text = decodeText(bytes, 'utf-8');
    const values = splitMultiValue(text).map(trimUIPadding);

    return collapseSingleValue(values);
};

// --------------------------------------------------
// DS
// --------------------------------------------------
const decodeDecimalString = (bytes: Uint8Array): DicomDecodedValue => {
    const text = decodeSingleTextValue(bytes);

    if (text === '') {
        return null;
    }

    const values = splitMultiValue(text)
        .map(value => value.trim())
        .filter(value => value.length > 0)
        .map(value => {
            const parsed = Number(value);

            return Number.isFinite(parsed) ? parsed : value;
        });

    return collapseSingleValue(values as DicomPrimitiveValue[]);
};

// --------------------------------------------------
// IS
// --------------------------------------------------
const decodeIntegerString = (bytes: Uint8Array): DicomDecodedValue => {
    const text = decodeSingleTextValue(bytes);

    if (text === '') {
        return null;
    }

    const values = splitMultiValue(text)
        .map(value => value.trim())
        .filter(value => value.length > 0)
        .map(value => {
            const parsed = Number.parseInt(value, 10);

            return Number.isNaN(parsed) ? value : parsed;
        });

    return collapseSingleValue(values as DicomPrimitiveValue[]);
};

// --------------------------------------------------
// Binary numeric helper
// --------------------------------------------------
const decodeBinaryValues = <T>(bytes: Uint8Array, bytesPerValue: number, read: (view: DataView, offset: number) => T): T | T[] | null => {
    if (bytes.byteLength === 0) {
        return null;
    }

    if (bytes.byteLength % bytesPerValue !== 0) {
        /**
         * 잘못된 VL인 경우 decoder에서 buffer를
         * 넘어 읽지 않는다.
         *
         * Parser 자체를 실패시키기보다는 rawValue를
         * 상위에서 유지할 수 있도록 null 처리한다.
         */
        return null;
    }

    const view = createDataView(bytes);

    const values: T[] = [];

    for (let offset = 0; offset < bytes.byteLength; offset += bytesPerValue) {
        values.push(read(view, offset));
    }

    return collapseSingleValue(values);
};

// --------------------------------------------------
// US
// --------------------------------------------------
const decodeUS = (bytes: Uint8Array, littleEndian: boolean): DicomDecodedValue => {
    return decodeBinaryValues(bytes, 2, (view, offset) => view.getUint16(offset, littleEndian));
};

// --------------------------------------------------
// SS
// --------------------------------------------------
const decodeSS = (bytes: Uint8Array, littleEndian: boolean): DicomDecodedValue => {
    return decodeBinaryValues(bytes, 2, (view, offset) => view.getInt16(offset, littleEndian));
};

// --------------------------------------------------
// UL
// --------------------------------------------------
const decodeUL = (bytes: Uint8Array, littleEndian: boolean): DicomDecodedValue => {
    return decodeBinaryValues(bytes, 4, (view, offset) => view.getUint32(offset, littleEndian));
};

// --------------------------------------------------
// SL
// --------------------------------------------------
const decodeSL = (bytes: Uint8Array, littleEndian: boolean): DicomDecodedValue => {
    return decodeBinaryValues(bytes, 4, (view, offset) => view.getInt32(offset, littleEndian));
};

// --------------------------------------------------
// UV
// --------------------------------------------------
const decodeUV = (bytes: Uint8Array, littleEndian: boolean): DicomDecodedValue => {
    return decodeBinaryValues(bytes, 8, (view, offset) => view.getBigUint64(offset, littleEndian));
};

// --------------------------------------------------
// SV
// --------------------------------------------------
const decodeSV = (bytes: Uint8Array, littleEndian: boolean): DicomDecodedValue => {
    return decodeBinaryValues(bytes, 8, (view, offset) => view.getBigInt64(offset, littleEndian));
};

// --------------------------------------------------
// FL
// --------------------------------------------------
const decodeFL = (bytes: Uint8Array, littleEndian: boolean): DicomDecodedValue => {
    return decodeBinaryValues(bytes, 4, (view, offset) => view.getFloat32(offset, littleEndian));
};

// --------------------------------------------------
// FD
// --------------------------------------------------
const decodeFD = (bytes: Uint8Array, littleEndian: boolean): DicomDecodedValue => {
    return decodeBinaryValues(bytes, 8, (view, offset) => view.getFloat64(offset, littleEndian));
};

// --------------------------------------------------
// AT
// --------------------------------------------------
const decodeAT = (bytes: Uint8Array, littleEndian: boolean): DicomDecodedValue => {
    return decodeBinaryValues<DecodedDicomTag>(bytes, 4,
        (view, offset) => ({
            group: view.getUint16(offset, littleEndian),
            element: view.getUint16(offset + 2, littleEndian),
        })
    );
};

// --------------------------------------------------
// Raw binary
// --------------------------------------------------
const decodeRaw = (bytes: Uint8Array): Uint8Array => {
    return bytes;
};

// --------------------------------------------------
// Public API
// --------------------------------------------------
export const decodeDicomValue = (
    vr: DicomVR | null,
    rawValue: Uint8Array | null,
    options: DecodeValueOptions = {}
): DicomDecodedValue => {
    if (rawValue === null) {
        return null;
    }

    /**
     * Implicit VR의 경우 FR-07 Dictionary가
     * 적용되기 전까지 VR을 알 수 없다.
     *
     * 추측해서 decode하지 않고 raw bytes를 반환한다.
     */
    if (vr === null) {
        return rawValue;
    }

    const littleEndian = options.littleEndian ?? true;
    const encoding = options.encoding ?? 'utf-8';

    switch (vr) {
        // --------------------------------------
        // Text
        // --------------------------------------
        case 'AE':
        case 'AS':
        case 'CS':
        case 'DA':
        case 'DT':
        case 'LO':
        case 'PN':
        case 'SH':
        case 'TM':
        case 'UC':
        case 'UR':
            return decodeMultiTextValue(rawValue, encoding);

        /**
         * LT / ST / UT는 자유 텍스트이므로
         * "\"를 Multi Value separator로
         * 처리하지 않는다.
         */
        case 'LT':
        case 'ST':
        case 'UT':
            return decodeSingleTextValue(rawValue, encoding);

        // --------------------------------------
        // UID
        // --------------------------------------
        case 'UI':
            return decodeUIValue(rawValue);

        // --------------------------------------
        // Numeric String
        // --------------------------------------
        case 'DS':
            return decodeDecimalString(rawValue);
        case 'IS':
            return decodeIntegerString(rawValue);

        // --------------------------------------
        // Binary Integer
        // --------------------------------------
        case 'US':
            return decodeUS(rawValue, littleEndian);
        case 'SS':
            return decodeSS(rawValue, littleEndian);
        case 'UL':
            return decodeUL(rawValue, littleEndian);
        case 'SL':
            return decodeSL(rawValue, littleEndian);
        case 'UV':
            return decodeUV(rawValue, littleEndian);
        case 'SV':
            return decodeSV(rawValue, littleEndian);

        // --------------------------------------
        // Floating Point
        // --------------------------------------
        case 'FL':
            return decodeFL(rawValue, littleEndian);
        case 'FD':
            return decodeFD(rawValue, littleEndian);

        // --------------------------------------
        // Attribute Tag
        // --------------------------------------
        case 'AT':
            return decodeAT(rawValue, littleEndian);

        // --------------------------------------
        // Sequence
        //
        // FR-06에서 처리
        // --------------------------------------
        case 'SQ':
            return rawValue;

        // --------------------------------------
        // Binary / Raw
        // --------------------------------------
        case 'OB':
        case 'OD':
        case 'OF':
        case 'OL':
        case 'OV':
        case 'OW':
        case 'UN':
            return decodeRaw(rawValue);
        default:
            return rawValue;
    }
};

export const decodeDataElement = (element: ParsedDataElement, transferSyntax: TransferSyntax, options: Omit<DecodeValueOptions, 'littleEndian'> = {}): DicomDecodedValue => {
    return decodeDicomValue(element.vr, element.rawValue, {
        ...options,
        littleEndian: transferSyntax.littleEndian,
    });
};
