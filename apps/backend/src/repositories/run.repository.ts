import { sql, inArray, eq, and, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AssessmentDbClient } from '../db/clients';
import { runs, type Run } from '../db/schema/assessment';
import type * as AssessmentDbSchema from '../db/schema/assessment';
import { BaseRepository } from './base.repository';
import type { BaseGetByIdParams } from './interfaces/base.repository.interface';

/**
 * Run stats for an administration (started/completed counts from assessment DB).
 */
export interface AdministrationRunStats {
  started: number;
  completed: number;
}

/**
 * Run Repository
 *
 * Provides data access methods for the runs table.
 * Extends BaseRepository for standard CRUD operations.
 */
export class RunRepository extends BaseRepository<Run, typeof runs> {
  constructor(db: NodePgDatabase<typeof AssessmentDbSchema> = AssessmentDbClient) {
    super(db, runs);
  }

  /**
   * Retrieves a run by ID, excluding soft-deleted records.
   *
   * Overrides the base implementation to filter out runs where `deletedAt` is set,
   * ensuring deleted runs are invisible to all code paths.
   *
   * @param params - Object containing the run ID
   * @returns The run if found and not soft-deleted, null otherwise
   */
  override async getById(params: BaseGetByIdParams): Promise<Run | null> {
    const [entity] = await this.db
      .select()
      .from(runs)
      .where(and(eq(runs.id, params.id), isNull(runs.deletedAt)))
      .limit(1);

    return entity ?? null;
  }

  /**
   * Get run stats (started, completed counts) for multiple administrations.
   *
   * - started: Count of distinct users who have at least one non-deleted run
   * - completed: Count of distinct users who have at least one non-deleted completed run
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

    // Count distinct users per administration (excluding soft-deleted runs):
    // - started: users with any non-deleted run record
    // - completed: users with at least one non-deleted run where completedAt is not null
    const result = await this.db
      .select({
        administrationId: runs.administrationId,
        started: sql<number>`COUNT(DISTINCT ${runs.userId})::int`,
        completed: sql<number>`COUNT(DISTINCT CASE WHEN ${runs.completedAt} IS NOT NULL THEN ${runs.userId} END)::int`,
      })
      .from(runs)
      .where(and(inArray(runs.administrationId, administrationIds), isNull(runs.deletedAt)))
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

  /**
   * Get a non-deleted run by administration ID.
   *
   * Returns the first non-deleted run found for the given administration, or null if none exist.
   * Useful for checking existence (null check) or accessing run data.
   *
   * @param administrationId - The administration ID to look up
   * @returns The first run for this administration, or null if none exist
   */
  async getByAdministrationId(administrationId: string): Promise<Run | null> {
    const result = await this.db
      .select()
      .from(runs)
      .where(and(eq(runs.administrationId, administrationId), isNull(runs.deletedAt)))
      .limit(1);

    return result[0] ?? null;
  }
}
