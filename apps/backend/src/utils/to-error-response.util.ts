import type { ApiError } from '../errors/api-error';
import { type ApiErrorBody, formatApiError } from './format-api-error.util';

/**
 * Convert an ApiError into a typed ts-rest error response.
 *
 * Returns `{ status, body }` when `error.statusCode` matches one of the expected statuses.
 * Re-throws the error otherwise so it reaches the global error handler.
 *
 * @param error - The ApiError to convert
 * @param expectedStatuses - Status codes this endpoint declares in its contract
 * @returns A ts-rest compatible response with a literal status type
 */
export function toErrorResponse<S extends number>(
  error: ApiError,
  expectedStatuses: S[],
): { status: S; body: ApiErrorBody } {
  if (expectedStatuses.includes(error.statusCode as S)) {
    return { status: error.statusCode as S, body: formatApiError(error) };
  }
  throw error;
}
