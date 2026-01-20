import type { DaydreamError, DaydreamErrorCode } from "./types/common";

export class BaseDaydreamError extends Error implements DaydreamError {
  readonly code: DaydreamErrorCode;
  readonly cause?: unknown;

  constructor(code: DaydreamErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "DaydreamError";
    this.code = code;
    this.cause = cause;
  }
}

export class NetworkError extends BaseDaydreamError {
  constructor(message: string, cause?: unknown) {
    super("NETWORK_ERROR", message, cause);
    this.name = "NetworkError";
  }
}

export class ConnectionError extends BaseDaydreamError {
  constructor(message: string, cause?: unknown) {
    super("CONNECTION_FAILED", message, cause);
    this.name = "ConnectionError";
  }
}

export class StreamNotFoundError extends BaseDaydreamError {
  constructor(message: string, cause?: unknown) {
    super("STREAM_NOT_FOUND", message, cause);
    this.name = "StreamNotFoundError";
  }
}

export class UnauthorizedError extends BaseDaydreamError {
  constructor(message: string, cause?: unknown) {
    super("UNAUTHORIZED", message, cause);
    this.name = "UnauthorizedError";
  }
}
