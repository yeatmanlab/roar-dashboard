import type { InferInsertModel } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base.repository';
import type { BaseCreateParams } from './interfaces/base.repository.interface';
import { rosteringProviderIds, type RosterProviderId } from '../db/schema';
import type * as CoreDbSchema from '../db/schema/core';
import { CoreDbClient } from '../db/clients';

/**
 * Rostering Provider IDs Repository
 *
 * Provides data access methods for the rostering_provider_ids table.
 *
 * Note: this table has no surrogate `id` column — its primary key is composite
 * (providerType, partnerId, providerId). create() is overridden to omit the
 * RETURNING id clause that BaseRepository.create() would otherwise generate.
 */
export class RosterProviderIdRepository extends BaseRepository<RosterProviderId, typeof rosteringProviderIds> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, rosteringProviderIds);
  }

  /**
   * Insert a new roster provider ID record.
   *
   * Overrides BaseRepository.create() because the base implementation selects
   * RETURNING { id } which does not exist on this composite-keyed table.
   * Returns entityId as a proxy to satisfy the { id: string } return contract.
   */
  override async create(
    params: BaseCreateParams<InferInsertModel<typeof rosteringProviderIds>>,
  ): Promise<{ id: string }> {
    const db = params.transaction ?? this.db;
    await db.insert(rosteringProviderIds).values(params.data);
    return { id: params.data.entityId };
  }
}
