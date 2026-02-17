import { RunsRepository, type AdministrationRunStats } from '../../repositories/runs.repository';
import type { Run } from '../../db/schema/assessment';

export type { Run };

/**
 * Runs Service
 *
 * Provides business logic for assessment runs. Runs are stored in the assessment
 * database, which is separate from the core database and has no FK constraints
 * to core entities.
 *
 * This service acts as the domain boundary for runs-related operations.
 */
export function RunsService({
  runsRepository = new RunsRepository(),
}: {
  runsRepository?: RunsRepository;
} = {}) {
  /**
   * Get run stats (started, completed counts) for multiple administrations.
   *
   * - started: Count of distinct users who have at least one run
   * - completed: Count of distinct users who have at least one completed run
   *
   * Administrations with no runs will not appear in the returned map.
   *
   * @param administrationIds - Array of administration IDs to get stats for
   * @returns Map of administration ID to run stats
   */
  async function getRunStatsByAdministrationIds(
    administrationIds: string[],
  ): Promise<Map<string, AdministrationRunStats>> {
    return runsRepository.getRunStatsByAdministrationIds(administrationIds);
  }

  /**
   * Get a run by administration ID.
   *
   * Returns the first run found for the given administration, or null if none exist.
   * Useful for checking existence (null check) or accessing run data.
   *
   * @param administrationId - The administration ID to look up
   * @returns The first run for this administration, or null if none exist
   */
  async function getByAdministrationId(administrationId: string): Promise<Run | null> {
    return runsRepository.getByAdministrationId(administrationId);
  }

  return {
    getRunStatsByAdministrationIds,
    getByAdministrationId,
  };
}
