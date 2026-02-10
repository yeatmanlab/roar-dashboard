import type { ApiError as ApiErrorBody } from '@roar-dashboard/api-contract';
import type { ApiError } from '../errors/api-error';

export type { ApiErrorBody };

/**
 * Format an ApiError into the standard error response body.
 *
 * Used by both:
 * - Controller layers (returning typed ts-rest responses)
 * - Global error handler (writing to Express `res`)
 *
 * @param apiError - The ApiError instance to format
 * @returns The error envelope body matching the API contract's ErrorEnvelopeSchema
 */
export function formatApiError(apiError: ApiError): ApiErrorBody {
  return {
    error: {
      message: apiError.message,
      code: apiError.code,
      traceId: apiError.traceId,
    },
  };
}
