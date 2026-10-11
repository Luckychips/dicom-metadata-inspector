import type {
    ParsedDicomFile,
    ParsedDataElement,
    ParsedDataset,
} from '@/cores';
import { normalizeDataset } from './dataset';
import { getNormalizedNumber, getNormalizedString } from './utils';
import type {
    NormalizedCharacterSet,
    NormalizedDicomFile,
    NormalizedDicomSummary,
} from './types';

/**
 * Specific Character Set
 *
 * (0008,0005)
 */
const CHARACTER_SET_GROUP = 0x0008;
const CHARACTER_SET_ELEMENT = 0x0005;

/**
 * ASCII 기반으로 Character Set 값 추출
 *
 * Specific Character Set 자체는 CS VR이므로
 * ASCII 호환 문자열이다.
 */
const extractCharacterSetValues = (elements: readonly ParsedDataElement[]): string[] => {
    const element =
        elements.find(item => item.tag.group === CHARACTER_SET_GROUP && item.tag.element === CHARACTER_SET_ELEMENT);

    if (!element?.rawValue) {
        return [];
    }

    const text = new TextDecoder('ascii').decode(element.rawValue).replace(/[\0 ]+$/g, '');
    return text.split('\\').map(value => value.trim()).filter(Boolean);
};

/**
 * Character Set 판별
 *
 * 현재 브라우저 TextDecoder로 안전하게
 * 처리할 수 있는 대표적인 단일 인코딩만 지원.
 */
const resolveCharacterSet = (elements: readonly ParsedDataElement[]): NormalizedCharacterSet => {
    const values = extractCharacterSetValues(elements);
    if (values.length === 0) {
        return {
            values: [],
            encoding: null,
            supported: true,
        };
    }

    /**
     * 여러 Character Set이 선언된 경우
     * ISO 2022 code extension 가능성이 있으므로
     * 단일 TextDecoder로 처리하지 않는다.
     */
    if (values.length !== 1) {
        return {
            values,
            encoding: null,
            supported: false,
        };
    }

    const value = values[0];
    switch (value) {
        case 'ISO_IR 6':
            return {
                values,
                encoding: null,
                supported: true,
            };
        case 'ISO_IR 100':
            return {
                values,
                encoding: 'iso-8859-1',
                supported: true,
            };
        case 'ISO_IR 192':
            return {
                values,
                encoding: 'utf-8',
                supported: true,
            };
        case 'GB18030':
            return {
                values,
                encoding: 'gb18030',
                supported: true,
            };
        default:
            return {
                values,
                encoding: null,
                supported: false,
            };
    }
};

/**
 * File Meta를 ParsedDataset 형태로 변환
 *
 * 기존 FileMetaElement 구조는 변경하지 않는다.
 */
const createFileMetaDataset = (parsed: ParsedDicomFile): ParsedDataset => {
    return {
        elements: parsed.fileMeta.elements.map(element => ({ ...element })),
        startOffset: 132,
        endOffset: parsed.fileMeta.datasetOffset,
        stoppedEarly: false,
    };
};

/**
 * 주요 Metadata 요약 생성
 */
export const createDicomSummary = (elements: NormalizedDicomFile['dataset']['elements']): NormalizedDicomSummary => {
    const getString = (group: number, element: number): string | null => {
        return getNormalizedString(elements, group, element);
    };

    const getNumber = (group: number, element: number): number | null => {
        return getNormalizedNumber(elements, group, element);
    };

    return {
        patientName: getString(0x0010, 0x0010),
        patientID: getString(0x0010, 0x0020),
        studyInstanceUID: getString(0x0020, 0x000d),
        seriesInstanceUID: getString(0x0020, 0x000e),
        sopInstanceUID: getString(0x0008, 0x0018),
        sopClassUID: getString(0x0008, 0x0016),
        modality: getString(0x0008, 0x0060),
        studyDate: getString(0x0008, 0x0020),
        studyTime: getString(0x0008, 0x0030),
        studyDescription: getString(0x0008, 0x1030),
        seriesDescription: getString(0x0008, 0x103e),
        seriesNumber: getNumber(0x0020, 0x0011),
        instanceNumber: getNumber(0x0020, 0x0013),
        rows: getNumber(0x0028, 0x0010),
        columns: getNumber(0x0028, 0x0011),
    };
};

/**
 * ParsedDicomFile → NormalizedDicomFile
 */
export const normalizeDicomFile = (parsed: ParsedDicomFile): NormalizedDicomFile => {
    const characterSet = resolveCharacterSet(parsed.dataset.elements);
    const fileMeta = normalizeDataset(
        createFileMetaDataset(parsed), {
            ...parsed.transferSyntax,
            explicitVR: true,
            littleEndian: true,
        }, {
            encoding: null,
        }
    );

    /**
     * Dataset 정규화
     */
    const dataset = normalizeDataset(parsed.dataset, parsed.transferSyntax, {
        encoding: characterSet.encoding,
    });

    const summary = createDicomSummary(dataset.elements);

    return {
        isPart10: parsed.isPart10,
        transferSyntax: parsed.transferSyntax,
        characterSet,
        fileMeta,
        dataset,
        summary,
    };
};
