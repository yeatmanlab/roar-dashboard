import type { Administration } from '../../db/schema';
import {
  AdministrationRepository,
  type AdministrationQueryOptions,
} from '../../repositories/administration.repository';
import type { PaginatedResult } from '@roar-dashboard/api-contract';

/**
 * AdministrationService
 *
 * Provides administration-related business logic operations.
 * Follows the factory pattern with dependency injection.
 *
 * @param params - Configuration object containing repository instances (optional)
 * @returns AdministrationService - An object with administration service methods.
 */
export function AdministrationService({
  administrationRepository = new AdministrationRepository(),
}: {
  administrationRepository?: AdministrationRepository;
} = {}) {
  /**
   * List all administrations with pagination, search, and sorting.
   * TODO: Add authorization - filter by user access when AuthorizationService is ready.
   */
  async function list(options: AdministrationQueryOptions): Promise<PaginatedResult<Administration>> {
    // For now, return all administrations
    // TODO: Check user type and filter by accessible administrations
    return administrationRepository.getAll(options);
  }

  /**
   * Get a single administration by ID.
   */
  async function getById(id: string): Promise<Administration | null> {
    return administrationRepository.get(id);
  }

  return { list, getById };
}
