import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { rosteringProviderEnum, rosteringEntityTypeEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Rostering Provider IDs Table
 *
 * Maps external rostering provider IDs to internal entity IDs. Third-party rostering
 * services (Clever, ClassLink, etc.) use their own IDs to identify orgs, classes,
 * courses, and users. This table maintains the bidirectional mapping for sync operations.
 *
 * Key fields:
 * - `providerType` - The rostering provider (Clever, ClassLink, etc.)
 * - `providerId` - External ID from the provider
 * - `entityType` - Type of internal entity (org, class, course, user)
 * - `entityId` - Internal UUID of the entity
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
    // Primary key: one provider ID per entity per provider type
    p.primaryKey({
      name: 'rostering_provider_ids_pk',
      columns: [table.providerType, table.entityType, table.entityId],
    }),

    // Constraints
    // - Provider IDs must be unique within each provider
    p.uniqueIndex('rostering_provider_ids_provider_id_unique_idx').on(table.providerType, table.providerId),

    // Indexes
    // - Find provider ID by internal entity
    p.index('rostering_provider_ids_entity_idx').on(table.entityType, table.entityId),
  ],
);

export type RosterProviderId = typeof rosteringProviderIds.$inferSelect;
export type NewRosterProviderId = typeof rosteringProviderIds.$inferInsert;
