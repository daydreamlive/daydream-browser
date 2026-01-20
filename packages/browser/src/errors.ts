import type { DaydreamError, DaydreamErrorCode } from "./types/common";

/**
 * Base class for all Daydream SDK errors.
 * Extends the standard Error with a code and optional cause for error chaining.
 *
 * @example
 * ```ts
 * try {
 *   await broadcast.connect();
 * } catch (err) {
 *   if (err instanceof BaseDaydreamError) {
 *     console.log("Error code:", err.code);
 *     console.log("Cause:", err.cause);
 *   }
 * }
 * ```
 */
export class BaseDaydreamError extends Error implements DaydreamError {
  /** Error code identifying the type of error. */
  readonly code: DaydreamErrorCode;
  /** The underlying cause of the error, if any. */
  readonly cause?: unknown;

  /**
   * Creates a new DaydreamError.
   * @param code - Error code
   * @param message - Human-readable error message
   * @param cause - Optional underlying cause
   */
  constructor(code: DaydreamErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "DaydreamError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Error thrown when a network request fails (e.g., fetch failed, timeout).
 */
export class NetworkError extends BaseDaydreamError {
  constructor(message: string, cause?: unknown) {
    super("NETWORK_ERROR", message, cause);
    this.name = "NetworkError";
  }
}

/**
 * Error thrown when a WebRTC connection fails to establish.
 */
export class ConnectionError extends BaseDaydreamError {
  constructor(message: string, cause?: unknown) {
    super("CONNECTION_FAILED", message, cause);
    this.name = "ConnectionError";
  }
}

/**
 * Error thrown when the requested stream does not exist (404).
 */
export class StreamNotFoundError extends BaseDaydreamError {
  constructor(message: string, cause?: unknown) {
    super("STREAM_NOT_FOUND", message, cause);
    this.name = "StreamNotFoundError";
  }
}

/**
 * Error thrown when authentication or authorization fails (401/403).
 */
export class UnauthorizedError extends BaseDaydreamError {
  constructor(message: string, cause?: unknown) {
    super("UNAUTHORIZED", message, cause);
    this.name = "UnauthorizedError";
  }
}
