import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../../enums/api-error-message.enum';
import { ApiError } from '../../../errors/api-error';

/**
 * Extract the raw ID from a fully qualified FGA object string.
 *
 * FGA objects use the format `type:id` (e.g., `administration:abc-123`).
 * This utility strips the type prefix and returns just the ID.
 *
 * @param fgaObject - Fully qualified FGA object (e.g., `administration:abc-123`)
 * @returns The ID portion after the colon (e.g., `abc-123`)
 * @throws {ApiError} INTERNAL_SERVER_ERROR if the FGA object string is malformed
 *
 * @example
 * ```ts
 * extractFgaObjectId('administration:abc-123') // 'abc-123'
 * ```
 */
export function extractFgaObjectId(fgaObject: string): string {
  const id = fgaObject.split(':')[1];
  if (!id) {
    throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
      context: { fgaObject },
    });
  }
  return id;
}
