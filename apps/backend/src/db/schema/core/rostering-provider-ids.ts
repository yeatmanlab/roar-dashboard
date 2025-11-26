import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { rosteringProviderEnum, rosteringEntityTypeEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Rostering Provider IDs Table
 *
 * Stores information about the rostering provider IDs for each entity. Third-party rostering services use these IDs to
 * uniquely identify orgs, classes, courses and users. We track those in this table to faciliate the creation and
 * syncing of these records with the third-party rostering services.
 */

export const rosteringProviderIds = db.table(
  'rostering_provider_ids',
  {
    providerType: rosteringProviderEnum().notNull(),
    providerId: p.text().notNull(),
    entityType: rosteringEntityTypeEnum().notNull(),
    entityId: p.uuid().notNull(),

    ...timestamps,
  },
  (table) => [
    // Primary key, enforces unique provider per entity
    p.primaryKey({
      name: 'rostering_provider_ids_pk',
      columns: [table.providerType, table.entityType, table.entityId],
    }),

    // Constraints
    // - Ensure provider_id is unique per entity
    p.uniqueIndex('rostering_provider_ids_uniqId').on(table.providerType, table.providerId),

    // Indexes
    // - Entity type and ID lookups
    p.index('rostering_provider_ids_entity_idx').on(table.entityType, table.entityId),

    // - Provider type and ID lookups
    p.index('rostering_provider_ids_provider_idx').on(table.providerType, table.providerId),
  ],
);

export type RosterProviderId = typeof rosteringProviderIds.$inferSelect;
export type NewRosterProviderId = typeof rosteringProviderIds.$inferInsert;
