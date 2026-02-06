import { sql, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AssessmentDbClient } from '../db/clients';
import { runs } from '../db/schema/assessment';
import type * as AssessmentDbSchema from '../db/schema/assessment';
import { BaseRepository } from './base.repository';
import type { Run } from '../db/schema'; // adjust if your Run type lives elsewhere

/**
 * Run stats for an administration (started/completed counts from assessment DB).
 */
export interface AdministrationRunStats {
  started: number;
  completed: number;
}

/**
 * Runs Repository
 *
 * Provides CRUD access to runs via BaseRepository,
 * plus purpose-built stats aggregation methods.
 */
export class RunsRepository extends BaseRepository<Run, typeof runs> {
  constructor(private readonly assessmentDb: NodePgDatabase<typeof AssessmentDbSchema> = AssessmentDbClient) {
    super(assessmentDb, runs);
  }

  /**
   * Get run stats (started, completed counts) for multiple administrations.
   */
  async getRunStatsByAdministrationIds(administrationIds: string[]): Promise<Map<string, AdministrationRunStats>> {
    if (administrationIds.length === 0) {
      return new Map();
    }

    const result = await this.assessmentDb
      .select({
        administrationId: runs.administrationId,
        started: sql<number>`COUNT(DISTINCT ${runs.userId})::int`,
        completed: sql<number>`COUNT(DISTINCT CASE WHEN ${runs.completedAt} IS NOT NULL THEN ${runs.userId} END)::int`,
      })
      .from(runs)
      .where(inArray(runs.administrationId, administrationIds))
      .groupBy(runs.administrationId);

    const statsMap = new Map<string, AdministrationRunStats>();
    for (const row of result) {
      statsMap.set(row.administrationId, {
        started: row.started,
        completed: row.completed,
      });
    }

    return statsMap;
  }
}
