export type { CollectionResult } from './file/collector';
export { collectSelectedFiles, captureDropSources, collectDroppedFiles } from './file/collector';
export { detectDicomFile } from './file/detector';
export { createFileKey, isDuplicate } from './file/duplicate';
export { processDicomFiles } from './file/processor';
export * from './file/types';

export * from './binary/types';
export * from './binary/reader';
export * from './binary/cursor';
export * from './binary/string';
export * from './binary/file';

// src/core/dicom/index.ts

export * from './dicom/types';
export * from './dicom/constants';
export * from './dicom/errors';
export * from './dicom/vr';

export * from './dicom/transfer';
export * from './dicom/header';
export * from './dicom/metadata';
export * from './dicom/parser/dataset';
export * from './dicom/parser/file';
