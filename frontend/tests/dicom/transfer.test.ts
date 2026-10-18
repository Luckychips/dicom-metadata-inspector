import { describe, expect, it } from 'vitest';
import { resolveTransferSyntax, parseDicomBuffer } from '@/cores';
import { createDicomFixture } from '../fixtures/dicom';

describe('Transfer Syntax', () => {
    describe('Standard Transfer Syntax', () => {
        it('resolves Implicit VR Little Endian', () => {
            const syntax = resolveTransferSyntax('1.2.840.10008.1.2');
            expect(syntax.kind).toBe('implicit-vr-little-endian');
            expect(syntax.explicitVR).toBe(false);
            expect(syntax.littleEndian).toBe(true);
            expect(syntax.encapsulated).toBe(false);
            expect(syntax.metadataSupported).toBe(true);
        });

        it('resolves Explicit VR Little Endian', () => {
            const syntax = resolveTransferSyntax('1.2.840.10008.1.2.1');
            expect(syntax.kind).toBe('explicit-vr-little-endian');
            expect(syntax.explicitVR).toBe(true);
            expect(syntax.littleEndian).toBe(true);
            expect(syntax.encapsulated).toBe(false);
            expect(syntax.metadataSupported).toBe(true);
        });

        it('resolves Explicit VR Big Endian', () => {
            const syntax = resolveTransferSyntax('1.2.840.10008.1.2.2');
            expect(syntax.kind).toBe('explicit-vr-big-endian');
            expect(syntax.explicitVR).toBe(true);
            expect(syntax.littleEndian).toBe(false);
            expect(syntax.metadataSupported).toBe(true);
        });
    });

    describe('Compressed Transfer Syntax', () => {
        it('recognizes Deflated Explicit VR Little Endian', () => {
            const syntax = resolveTransferSyntax('1.2.840.10008.1.2.1.99');
            expect(syntax.kind).toBe('deflated-explicit-vr-little-endian');
            expect(syntax.metadataSupported).toBe(false);
        });

        it('recognizes JPEG Baseline', () => {
            const syntax = resolveTransferSyntax('1.2.840.10008.1.2.4.50');
            expect(syntax.kind).toBe('encapsulated-explicit-vr-little-endian');
            expect(syntax.explicitVR).toBe(true);
            expect(syntax.littleEndian).toBe(true);
            expect(syntax.encapsulated).toBe(true);
            expect(syntax.metadataSupported).toBe(true);
            expect(syntax.pixelDataDecodingSupported).toBe(false);
        });

        it('recognizes RLE Lossless', () => {
            const syntax = resolveTransferSyntax('1.2.840.10008.1.2.5');
            expect(syntax.encapsulated).toBe(true);
            expect(syntax.metadataSupported).toBe(true);
            expect(syntax.pixelDataDecodingSupported).toBe(false);
        });
    });

    describe('Unknown Transfer Syntax', () => {
        it('marks unknown UID as unsupported', () => {
            const syntax = resolveTransferSyntax('1.2.826.0.1.3680043.10.99999');
            expect(syntax.kind).toBe('unknown');
            expect(syntax.metadataSupported).toBe(false);
            expect(syntax.pixelDataDecodingSupported).toBe(false);
        });
    });

    describe('Parser integration', () => {
        it('uses Explicit VR Little Endian from File Meta', () => {
            const result = parseDicomBuffer(createDicomFixture({ transferSyntaxUID: '1.2.840.10008.1.2.1' }));
            expect(result.transferSyntax.explicitVR).toBe(true);
            expect(result.transferSyntax.littleEndian).toBe(true);
        });

        it('uses Implicit VR Little Endian from File Meta', () => {
            const result = parseDicomBuffer(createDicomFixture({ transferSyntaxUID: '1.2.840.10008.1.2' }));
            expect(result.transferSyntax.explicitVR).toBe(false);
            expect(result.transferSyntax.littleEndian).toBe(true);
        });

        it('rejects an unsupported Transfer Syntax', () => {
            const buffer = createDicomFixture({ transferSyntaxUID: '1.2.826.0.1.3680043.10.99999' });
            expect(() => parseDicomBuffer(buffer)).toThrow();
        });

        it('rejects Deflated Dataset without decompression', () => {
            const buffer = createDicomFixture({ transferSyntaxUID: '1.2.840.10008.1.2.1.99' });
            expect(() => parseDicomBuffer(buffer)).toThrow();
        });
    });
});
