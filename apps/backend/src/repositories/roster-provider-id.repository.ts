import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base.repository';
import { rosteringProviderIds, type RosterProviderId } from '../db/schema';
import type * as CoreDbSchema from '../db/schema/core';
import { CoreDbClient } from '../db/clients';

/**
 * Rostering Provider IDs Repository
 *
 * Provides datea access methods for the rostering_provider_ids table.
 * Extends BaseRepository for standard CRUD operations.
 */
export class RosterProviderIdRepository extends BaseRepository<RosterProviderId, typeof rosteringProviderIds> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, rosteringProviderIds);
  }
}
