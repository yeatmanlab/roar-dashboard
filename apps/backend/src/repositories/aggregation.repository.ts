import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { fdwRuns } from '../db/schema/assessment-fdw/runs';
import { fdwRunScores } from '../db/schema/assessment-fdw/run-scores';
import { runDemographics } from '../db/schema/core/run-demographics';
import { userClasses } from '../db/schema/core/user-classes';
import { classes } from '../db/schema/core/classes';
import { orgs } from '../db/schema/core/orgs';

interface RunRecord {
  id: string;
  userId: string;
  taskVariantId: string;
  administrationId: string;
}

interface UserSchoolRecord {
  userId: string;
  schoolId: string;
  schoolName: string;
}

/**
 * Aggregation Repository
 *
 * Provides data access methods for data aggregation services upstream.
 */
export class AggregationRepository {
  constructor(private readonly coreDb: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  async getBestRunsForVariants(administrationId: string, variantIds: string[]): Promise<RunRecord[]> {
    return this.coreDb
      .select({
        id: fdwRuns.id,
        userId: fdwRuns.userId,
        taskVariantId: fdwRuns.taskVariantId,
        administrationId: fdwRuns.administrationId,
      })
      .from(fdwRuns)
      .where(
        and(
          eq(fdwRuns.administrationId, administrationId),
          inArray(fdwRuns.taskVariantId, variantIds),
          eq(fdwRuns.useForReporting, true),
          isNull(fdwRuns.deletedAt),
        ),
      );
  }

  async getDemographicsByRunIds(runIds: string[]): Promise<Map<string, string | null>> {
    const records = await this.coreDb
      .select({ runId: runDemographics.runId, grade: runDemographics.grade })
      .from(runDemographics)
      .where(inArray(runDemographics.runId, runIds));

    return new Map(records.map((d) => [d.runId, d.grade]));
  }

  /**
   * All score rows for the given runs, indexed `runId → name → value`.
   *
   * Returned unresolved: which name holds a task's percentile or raw score
   * depends on its slug, grade, and scoring version, so the service resolves
   * them via `resolveScoreFieldNames`.
   */
  async getScoresByRunIds(runIds: string[]): Promise<Map<string, Map<string, string>>> {
    const scoresData = await this.coreDb
      .select({
        runId: fdwRunScores.runId,
        name: fdwRunScores.name,
        value: fdwRunScores.value,
      })
      .from(fdwRunScores)
      .where(inArray(fdwRunScores.runId, runIds));

    const scoresByRunId = new Map<string, Map<string, string>>();
    for (const runId of runIds) {
      scoresByRunId.set(runId, new Map());
    }

    for (const score of scoresData) {
      scoresByRunId.get(score.runId)?.set(score.name, score.value);
    }

    return scoresByRunId;
  }

  async getUserSchoolsByUserIds(userIds: string[]): Promise<UserSchoolRecord[]> {
    return this.coreDb
      .select({
        userId: userClasses.userId,
        schoolId: classes.schoolId,
        schoolName: orgs.name,
      })
      .from(userClasses)
      .innerJoin(classes, eq(userClasses.classId, classes.id))
      .innerJoin(orgs, eq(classes.schoolId, orgs.id))
      .where(and(inArray(userClasses.userId, userIds), isNull(userClasses.enrollmentEnd)));
  }
}
