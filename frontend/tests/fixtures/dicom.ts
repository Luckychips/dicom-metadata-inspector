const encoder = new TextEncoder();

export const concatBytes = (
    ...parts: Uint8Array[]
): Uint8Array => {
    const length = parts.reduce(
        (sum, part) => sum + part.byteLength,
        0
    );

    const result = new Uint8Array(length);
    let offset = 0;

    for (const part of parts) {
        result.set(part, offset);
        offset += part.byteLength;
    }

    return result;
};

export const le16 = (value: number): Uint8Array => {
    const result = new Uint8Array(2);
    new DataView(result.buffer).setUint16(0, value, true);
    return result;
};

export const le32 = (value: number): Uint8Array => {
    const result = new Uint8Array(4);
    new DataView(result.buffer).setUint32(0, value, true);
    return result;
};

export const encodeText = (
    value: string,
    vr: string
): Uint8Array => {
    const bytes = encoder.encode(value);

    if (bytes.byteLength % 2 === 0) {
        return bytes;
    }

    return concatBytes(
        bytes,
        new Uint8Array([vr === 'UI' ? 0 : 0x20])
    );
};

const LONG_VR = new Set([
    'OB', 'OD', 'OF', 'OL', 'OV', 'OW',
    'SQ', 'UC', 'UN', 'UR', 'UT', 'UV',
]);

export const explicitElement = (
    group: number,
    element: number,
    vr: string,
    value: Uint8Array
): Uint8Array => {
    const tag = concatBytes(le16(group), le16(element));
    const vrBytes = encoder.encode(vr);

    const header = LONG_VR.has(vr)
        ? concatBytes(
            tag,
            vrBytes,
            le16(0),
            le32(value.byteLength)
        )
        : concatBytes(
            tag,
            vrBytes,
            le16(value.byteLength)
        );

    return concatBytes(header, value);
};

export const implicitElement = (
    group: number,
    element: number,
    value: Uint8Array
): Uint8Array =>
    concatBytes(
        le16(group),
        le16(element),
        le32(value.byteLength),
        value
    );

export const explicitText = (
    group: number,
    element: number,
    vr: string,
    value: string
): Uint8Array =>
    explicitElement(
        group,
        element,
        vr,
        encodeText(value, vr)
    );

export const implicitText = (
    group: number,
    element: number,
    vr: string,
    value: string
): Uint8Array =>
    implicitElement(
        group,
        element,
        encodeText(value, vr)
    );

export interface DicomFixtureOptions {
    transferSyntaxUID?: string;
    patientName?: string;
    patientID?: string;
    additionalElements?: Uint8Array[];
}

export const createDicomFixture = (
    options: DicomFixtureOptions = {}
): ArrayBuffer => {
    const transferSyntaxUID =
        options.transferSyntaxUID ??
        '1.2.840.10008.1.2.1';

    const implicitVR =
        transferSyntaxUID === '1.2.840.10008.1.2';

    const sopClassUID = '1.2.840.10008.5.1.4.1.1.2';
    const sopInstanceUID = '1.2.826.0.1.3680043.10.1000.101';

    const fileMetaBody = concatBytes(
        explicitText(0x0002, 0x0002, 'UI', sopClassUID),
        explicitText(0x0002, 0x0003, 'UI', sopInstanceUID),
        explicitText(0x0002, 0x0010, 'UI', transferSyntaxUID),
        explicitText(
            0x0002,
            0x0012,
            'UI',
            '1.2.826.0.1.3680043.10.1000'
        )
    );

    const fileMeta = concatBytes(
        explicitElement(
            0x0002,
            0x0000,
            'UL',
            le32(fileMetaBody.byteLength)
        ),
        fileMetaBody
    );

    const makeText = implicitVR
        ? implicitText
        : explicitText;

    const dataset = concatBytes(
        makeText(0x0008, 0x0016, 'UI', sopClassUID),
        makeText(0x0008, 0x0018, 'UI', sopInstanceUID),
        makeText(0x0008, 0x0060, 'CS', 'CT'),
        makeText(
            0x0010,
            0x0010,
            'PN',
            options.patientName ?? 'TEST^PATIENT'
        ),
        makeText(
            0x0010,
            0x0020,
            'LO',
            options.patientID ?? 'TEST001'
        ),
        ...(options.additionalElements ?? [])
    );

    const bytes = concatBytes(
        new Uint8Array(128),
        encoder.encode('DICM'),
        fileMeta,
        dataset
    );

    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
};

export const createDicomTestFile = (
    name = 'test.dcm',
    options: DicomFixtureOptions = {}
): File =>
    new File(
        [createDicomFixture(options)],
        name,
        { type: 'application/dicom' }
    );
