import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors';

/**
 * Validation function that verifies that all ids from entityIdsToCheck exist in allEntities.
 *
 * @param allEntities - Array of existing entities
 * @param entityIdsToCheck - Array of all entity IDs to verify
 * @throws {ApiError} If any entity IDs are not found in allEntities
 */
function verifyEntitiesExist(allEntities: { id: string }[], entityIdsToCheck: string[]): void {
  const existingEntityIds = allEntities.map((entity) => entity.id);
  const missingEntityIds = entityIdsToCheck.filter((id) => !existingEntityIds.includes(id));
  if (missingEntityIds.length > 0) {
    throw new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      context: { entityIds: missingEntityIds },
    });
  }
}

export { verifyEntitiesExist };
