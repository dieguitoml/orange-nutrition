export type DataErrorCode = 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'QUOTA' | 'DB' | 'CONVERSION' | 'UNAVAILABLE';

/** Typed error for every failure surfaced by repositories and services. */
export class DataError extends Error {
  constructor(
    readonly code: DataErrorCode,
    message: string,
    readonly details?: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'DataError';
  }
}

export function isDataError(e: unknown): e is DataError {
  return e instanceof DataError;
}
