import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { groupTypeEnum } from '../enums';
import { timestamps } from '../common';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * Groups Table
 *
 * Stores information about groups in the system. Groups can be structured hierarchically through the
 * `parentGroupId` column. Commonly, groups are cohorts, communities, or businesses.
 *
 * Unlike orgs, groups are not synced via third-party rostering providers. Instead, groups are
 * created/rostered internally within the dashboard. Users are assigned to groups either manually or via CSV upload.
 *
 * Additionally, groups are used to manage administrations for families through the ROAR at Home program.
 *
 * @see {@link groups.parentGroupId} - Self-reference for hierarchical structure
 *
 * @todo Decide whether the group's hierarchical structure is needed if deprecated in families.
 */
export const groups = db.table(
  'groups',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    abbreviation: p.varchar({ length: 10 }).notNull(),
    name: p.text().notNull(),

    groupType: groupTypeEnum().notNull(),
    parentGroupId: p.uuid().references((): AnyPgColumn => groups.id, { onDelete: 'restrict' }),

    locationAddressLine1: p.text(),
    locationAddressLine2: p.text(),
    locationCity: p.text(),
    locationStateProvince: p.text(),
    locationPostalCode: p.text(),
    locationCountry: p.varchar({ length: 2 }),
    locationLatLong: p.point(),

    rosteringEnded: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Constraints
    // - Ensure abbreviation format only contains letters and numbers
    p.check('orgs_abbreviation_format', sql`${table.abbreviation} ~ '^[A-Za-z0-9]+$'`),

    // Indexes
    // - Hierarchical lookups
    p.index('groups_parent_idx').on(table.parentGroupId),

    // - Name equality or prefix lookups
    p.index('groups_name_lower_idx').on(sql`lower(${table.name})`),
    p.index('groups_name_lower_pattern_idx').on(sql`lower(${table.name}) text_pattern_ops`),
  ],
);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
