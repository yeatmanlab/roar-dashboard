import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { groupTypeEnum } from '../enums';
import { timestamps } from '../common';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * Groups Table
 *
 * Stores information about groups in the system. Just like orgs, groups can be structured hierarchically through the
 * `parent_group_id` column. Commonly, groups are cohorts, communities or businesses.
 *
 * Compared to orgs, groups are not automatically rostered through a third-party provider. Instead, groups are currently
 * created manually within the dashboard. Users are then assigned to groups either manually via the dashboard, or
 * through CSV upload.
 *
 * @TODO: Decide whether the group's hierachical structure is needed if deprecated in families.
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
    parentGroupId: p.uuid().references((): AnyPgColumn => groups.id),

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
    // Indexes
    // - Hierachical lookups
    p.index('groups_parent_idx').on(table.parentGroupId),

    // - Name equality or prefix lookups
    p.index('groups_name_lower_idx').on(sql`(${table.name})`),
  ],
);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
