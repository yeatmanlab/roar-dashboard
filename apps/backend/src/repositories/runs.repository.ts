import { sql, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AssessmentDbClient } from '../db/clients';
import { runs } from '../db/schema/assessment';
import type * as AssessmentDbSchema from '../db/schema/assessment';

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
 * Provides data access methods for the runs table in the assessment database.
 * This is a purpose-built repository for stats aggregation, not a full CRUD repository.
 */
export class RunsRepository {
  constructor(private readonly db: NodePgDatabase<typeof AssessmentDbSchema> = AssessmentDbClient) {}

  /**
   * Get run stats (started, completed counts) for multiple administrations.
   *
   * - started: Count of distinct users who have at least one run
   * - completed: Count of distinct users who have at least one completed run
   *
   * Returns a Map where keys are administration IDs and values are the stats.
   * Administrations with no runs will not appear in the map.
   *
   * @param administrationIds - Array of administration IDs to get stats for
   * @returns Map of administration ID to run stats
   */
  async getRunStatsByAdministrationIds(administrationIds: string[]): Promise<Map<string, AdministrationRunStats>> {
    if (administrationIds.length === 0) {
      return new Map();
    }

    // Count distinct users per administration:
    // - started: users with any run record
    // - completed: users with at least one run where completedAt is not null
    const result = await this.db
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
