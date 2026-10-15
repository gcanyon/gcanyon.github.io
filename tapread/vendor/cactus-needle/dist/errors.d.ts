/// <reference lib="esnext.disposable" />
//#region src/errors.d.ts
export type NeedleErrorCode = 'INVALID_ARGUMENT' | 'UNSUPPORTED_ENVIRONMENT' | 'MODEL_NOT_FOUND' | 'INVALID_MODEL' | 'ENGINE_ERROR' | 'INVALID_RESPONSE' | 'WORKER_ERROR' | 'CLOSED' | 'DOWNLOAD_FAILED' | 'INTEGRITY_ERROR';
export declare class NeedleError extends Error {
  readonly code: NeedleErrorCode;
  readonly name: string;
  constructor(code: NeedleErrorCode, message: string, options?: ErrorOptions);
}
export declare class ExtractionValidationError extends NeedleError {
  readonly name = "ExtractionValidationError";
  constructor(message?: string);
}
//#endregion
//# sourceMappingURL=errors.d.ts.map