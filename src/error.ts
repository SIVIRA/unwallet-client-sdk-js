export type UWErrorCode =
  | "CONNECTION_TIMEOUT"
  | "CONNECTION_FAILED"
  | "CONNECTION_NOT_OPENED"
  | "CONNECTION_CLOSED"
  | "INVALID_REQUEST"
  | "REQUEST_IN_PROGRESS"
  | "REQUEST_REJECTED"
  | "INVALID_RESPONSE";

export class UWError extends Error {
  static {
    this.prototype.name = "UWError";
  }

  public readonly code: UWErrorCode;

  constructor(code: UWErrorCode, message?: string) {
    super(message !== undefined ? `${code}: ${message}` : code);
    this.code = code;
  }
}
