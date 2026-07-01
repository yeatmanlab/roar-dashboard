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

  async getScoresByRunIds(
    runIds: string[],
  ): Promise<Map<string, { percentile: number | null; rawScore: number | null; scoringVersion: number | null }>> {
    const scoresData = await this.coreDb
      .select({
        runId: fdwRunScores.runId,
        type: fdwRunScores.type,
        name: fdwRunScores.name,
        value: fdwRunScores.value,
      })
      .from(fdwRunScores)
      .where(inArray(fdwRunScores.runId, runIds));

    const scoresByRunId = new Map<
      string,
      { percentile: number | null; rawScore: number | null; scoringVersion: number | null }
    >();

    for (const score of scoresData) {
      if (!scoresByRunId.has(score.runId)) {
        scoresByRunId.set(score.runId, { percentile: null, rawScore: null, scoringVersion: null });
      }
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
