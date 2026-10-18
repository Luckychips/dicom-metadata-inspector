const encoder = new TextEncoder();

export type FixtureTransferSyntax = | 'explicit-le' | 'implicit-le' | 'explicit-be';

export const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
    const size = parts.reduce((total, part) => total + part.byteLength, 0);
    const output = new Uint8Array(size);
    let offset = 0;

    for (const part of parts) {
        output.set(part, offset);
        offset += part.byteLength;
    }

    return output;
};

export const u16 = (value: number, littleEndian = true): Uint8Array => {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, littleEndian);
    return bytes;
};

export const u32 = (value: number, littleEndian = true): Uint8Array => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, littleEndian);
    return bytes;
};

const LONG_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT', 'UV']);

export const textValue = (value: string, vr = 'LO'): Uint8Array => {
    const bytes = encoder.encode(value);
    if (bytes.length % 2 === 0) return bytes;
    return concatBytes(bytes, new Uint8Array([vr === 'UI' ? 0 : 0x20]));
};

export const dicomElement = (
    group: number,
    element: number,
    vr: string,
    value: Uint8Array,
    syntax: FixtureTransferSyntax = 'explicit-le'
): Uint8Array => {
    const littleEndian = syntax !== 'explicit-be';
    const tag = concatBytes(u16(group, littleEndian), u16(element, littleEndian));
    if (syntax === 'implicit-le') {
        return concatBytes(tag, u32(value.byteLength), value);
    }

    const vrBytes = encoder.encode(vr);
    const length = LONG_VR.has(vr)
        ? concatBytes(u16(0, littleEndian), u32(value.byteLength, littleEndian))
        : u16(value.byteLength, littleEndian);

    return concatBytes(tag, vrBytes, length, value);
};

export const textElement = (
    group: number,
    element: number,
    vr: string,
    value: string,
    syntax: FixtureTransferSyntax = 'explicit-le'
): Uint8Array => {
    return dicomElement(group, element, vr, textValue(value, vr), syntax);
}

export const transferSyntaxUID = (syntax: FixtureTransferSyntax): string => {
    switch (syntax) {
        case 'implicit-le':
            return '1.2.840.10008.1.2';
        case 'explicit-be':
            return '1.2.840.10008.1.2.2';
        default:
            return '1.2.840.10008.1.2.1';
    }
};

export interface FixtureOptions {
    syntax?: FixtureTransferSyntax;
    patientName?: string;
    patientID?: string;
    studyUID?: string;
    seriesUID?: string;
    sopUID?: string;
    additionalElements?: Uint8Array[];
}

export const createPart10Bytes = (options: FixtureOptions = {}): Uint8Array => {
    const syntax = options.syntax ?? 'explicit-le';
    const sopUID = options.sopUID ?? '1.2.826.0.1.3680043.10.1000.3';
    const sopClassUID = '1.2.840.10008.5.1.4.1.1.2';
    const metaBody = concatBytes(
        textElement(0x0002, 0x0002, 'UI', sopClassUID),
        textElement(0x0002, 0x0003, 'UI', sopUID),
        textElement(0x0002, 0x0010, 'UI', transferSyntaxUID(syntax)),
        textElement(0x0002, 0x0012, 'UI', '1.2.826.0.1.3680043.10.1000')
    );

    const meta = concatBytes(
        dicomElement(0x0002, 0x0000, 'UL', u32(metaBody.byteLength)),
        metaBody
    );

    const dataset = [
        textElement(0x0008, 0x0016, 'UI', sopClassUID, syntax),
        textElement(0x0008, 0x0018, 'UI', sopUID, syntax),
        textElement(0x0008, 0x0060, 'CS', 'CT', syntax),
        textElement(0x0010, 0x0010, 'PN', options.patientName ?? 'TEST^PATIENT', syntax),
        textElement(0x0010, 0x0020, 'LO', options.patientID ?? 'TEST001', syntax),
        textElement(0x0020, 0x000d, 'UI', options.studyUID ?? '1.2.826.0.1.3680043.10.1000.1', syntax),
        textElement(0x0020, 0x000e, 'UI', options.seriesUID ?? '1.2.826.0.1.3680043.10.1000.2', syntax
        ),
        ...(options.additionalElements ?? []),
    ];

    return concatBytes(
        new Uint8Array(128),
        encoder.encode('DICM'),
        meta,
        ...dataset
    );
};

export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer;

export const createPart10Buffer = (options: FixtureOptions = {}): ArrayBuffer => {
    return toArrayBuffer(createPart10Bytes(options));
}

export const createPart10File = (name = 'test.dcm', options: FixtureOptions = {}): File => {
    return new File([createPart10Buffer(options)], name, { type: 'application/dicom' });
}
