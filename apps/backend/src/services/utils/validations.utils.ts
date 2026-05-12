import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors';
import { logger } from '../../logger';

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

/**
 * Throws a 404 `ApiError` if the given user has had their rostering ended
 * (i.e., `rosteringEnded` is set to a timestamp at or before now).
 *
 * Rostering-ended users are decommissioned (#1742): any URL that names them
 * as a target — single-user lookup, per-user reporting, PATCH, agreement
 * record, user-scoped administration list — returns 404 with no
 * access-control distinction. The 404 shape is symmetric to a not-found user
 * — same `ApiErrorMessage.NOT_FOUND`, same `ApiErrorCode.RESOURCE_NOT_FOUND`
 * — so requesters can't infer whether the target ever existed.
 *
 * Centralized here so every per-user endpoint applies the same predicate
 * with the same response shape and log message format.
 *
 * @param targetUser - The user record to check; only `rosteringEnded` is read.
 * @param context - Structured context for the warn log + error context object.
 *                  Pass `requesterUserId`, `targetUserId`, plus any extra
 *                  identifiers relevant to the calling endpoint.
 * @param operation - Short label for the log line (e.g., "PATCH",
 *                    "Agreement record", "Per-user administration lookup").
 * @throws {ApiError} 404 NOT_FOUND when the user is rostering-ended.
 */
function rejectRosteringEndedTarget(
  targetUser: { rosteringEnded: Date | null },
  context: Record<string, unknown>,
  operation: string,
): void {
  if (targetUser.rosteringEnded !== null && targetUser.rosteringEnded <= new Date()) {
    logger.warn(
      { ...context, rosteringEnded: targetUser.rosteringEnded },
      `${operation} attempted on rostering-ended user`,
    );
    throw new ApiError(ApiErrorMessage.NOT_FOUND, {
      statusCode: StatusCodes.NOT_FOUND,
      code: ApiErrorCode.RESOURCE_NOT_FOUND,
      context: { ...context, rosteringEnded: targetUser.rosteringEnded },
    });
  }
}

export { verifyEntitiesExist, rejectRosteringEndedTarget };
