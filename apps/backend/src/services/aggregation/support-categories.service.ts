import { StatusCodes } from 'http-status-codes';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { logger } from '../../logger';
import { ApiError } from '../../errors/api-error';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { AdministrationRepository } from '../../repositories/administration.repository';
import type * as CoreDbSchema from '../../db/schema/core';

export type SupportLevel = 'achievedSkill' | 'developingSkill' | 'needsExtraSupport';

export interface SchoolGradeCounts {
  schools: Record<string, { name: string; count: number }>;
  grades: Record<string, number>;
  total: number;
}

export interface TaskCounts {
  achievedSkill: SchoolGradeCounts;
  developingSkill: SchoolGradeCounts;
  needsExtraSupport: SchoolGradeCounts;
  raw: Record<string, SchoolGradeCounts>;
  percentile: Record<string, SchoolGradeCounts>;
}

export type AggregatedSupportCategories = Record<string, TaskCounts>;

/**
 * Aggregates support category counts and distributions across schools and grades
 * for multiple assessment tasks within a district administration.
 *
 * **STUB IMPLEMENTATION**: Currently returns empty aggregation structure.
 *
 * Full implementation requires:
 * - Query administration_task_variants to get scored tasks for the administration
 * - Fetch FDW runs (assessment.runs via foreign table) with useForReporting=true
 * - Join run_demographics (core.run_demographics) for grade data by runId
 * - Join user enrollments (user_classes, user_orgs) for school memberships by userId
 * - Join assessment DB scores table for score/percentile data by runId
 * - Classify each run by support level using getSupportLevel() with score + grade
 * - Aggregate into support levels (achieved, developing, needs support)
 * - Further aggregate by school and grade, plus score ranges (raw + percentile)
 *
 * @param params - Input parameters with assignmentId and districtId
 * @param dependencies - Injected dependencies (optional, uses defaults)
 * @returns Aggregated support categories by task (empty structure for now)
 * @throws {ApiError} NOT_FOUND if administration doesn't exist
 */
export async function aggregateSupportCategories(
  params: {
    assignmentId: string;
    districtId: string;
  },
  dependencies?: {
    administrationRepository?: AdministrationRepository;
    coreDb?: NodePgDatabase<typeof CoreDbSchema>;
  },
): Promise<AggregatedSupportCategories | null> {
  const { assignmentId, districtId } = params;
  const administrationRepository = dependencies?.administrationRepository ?? new AdministrationRepository();

  // Verify administration exists and user has access (authorization done in service layer)
  const administration = await administrationRepository.getById({ id: assignmentId });
  if (!administration) {
    throw new ApiError(ApiErrorMessage.NOT_FOUND, {
      statusCode: StatusCodes.NOT_FOUND,
      code: ApiErrorCode.RESOURCE_NOT_FOUND,
      context: { assignmentId, districtId },
    });
  }

  logger.info(
    { administrationId: assignmentId, districtId },
    'Support categories aggregation is not yet implemented - returning empty structure',
  );

  // TODO: Implement full aggregation
  // For now, return empty structure so frontend doesn't break
  return {};
}
