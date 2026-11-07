import { ZodError } from 'zod';
import { DataError } from '../../core/utils/errors';
import { ConversionError } from '../../core/utils/units';
import { formatZodIssues } from '../../core/validation/schemas';

/** Maps any thrown value to a DataError with a stable code. */
export function toDataError(e: unknown, context: string): DataError {
  if (e instanceof DataError) return e;
  if (e instanceof ZodError) return new DataError('VALIDATION', `${context}: invalid data`, formatZodIssues(e), { cause: e });
  if (e instanceof ConversionError) return new DataError('CONVERSION', `${context}: ${e.message}`, undefined, { cause: e });
  const name = (e as { name?: string })?.name ?? '';
  const inner = (e as { inner?: { name?: string } })?.inner?.name ?? '';
  const msg = (e as { message?: string })?.message ?? String(e);
  if (name === 'QuotaExceededError' || inner === 'QuotaExceededError') return new DataError('QUOTA', `${context}: device storage is full`, undefined, { cause: e });
  if (name === 'ConstraintError' || inner === 'ConstraintError') return new DataError('CONFLICT', `${context}: record already exists`, undefined, { cause: e });
  if (name === 'MissingAPIError' || name === 'InvalidStateError') return new DataError('UNAVAILABLE', `${context}: IndexedDB is unavailable (private mode?)`, undefined, { cause: e });
  return new DataError('DB', `${context}: ${msg}`, undefined, { cause: e });
}

/** Runs an async operation and normalizes errors. */
export async function guard<T>(context: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw toDataError(e, context);
  }
}
