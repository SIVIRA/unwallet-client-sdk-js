export const VALID_UW_ERROR_CODES = [
  "CONNECTION_TIMEOUT",
  "CONNECTION_FAILED",
  "CONNECTION_NOT_OPENED",
  "CONNECTION_CLOSED",
  "INVALID_REQUEST",
  "REQUEST_IN_PROGRESS",
  "REQUEST_REJECTED",
  "INVALID_RESPONSE",
] as const;

export type UWErrorCode = (typeof VALID_UW_ERROR_CODES)[number];

export class UWError extends Error {
  public readonly code: UWErrorCode;

  constructor(code: UWErrorCode, message?: string) {
    super(message !== undefined ? `${code}: ${message}` : code);
    this.code = code;
  }

  static {
    this.prototype.name = "UWError";
  }
}
