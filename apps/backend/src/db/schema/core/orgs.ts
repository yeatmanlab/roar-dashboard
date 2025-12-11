import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { orgTypeEnum } from '../enums';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * Orgs Table
 *
 * Stores information about organizations in the system. Orgs follow a hierarchical structure
 * (national → state → local → district → school → department) defined by the `parentOrgId` column.
 * Orgs are exclusively synced via third-party rostering providers (e.g., Clever, ClassLink).
 *
 * @see {@link orgs.parentOrgId} - Self-reference for hierarchical structure
 */

export const orgs = db.table(
  'orgs',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    abbreviation: p.varchar({ length: 10 }).notNull(),
    name: p.text().notNull(),

    orgType: orgTypeEnum().notNull(),
    parentOrgId: p.uuid().references((): AnyPgColumn => orgs.id, { onDelete: 'restrict' }),

    locationAddressLine1: p.text(),
    locationAddressLine2: p.text(),
    locationCity: p.text(),
    locationStateProvince: p.text(),
    locationPostalCode: p.text(),
    locationCountry: p.varchar({ length: 2 }),
    locationLatLong: p.point(),

    mdrNumber: p.text(),
    ncesId: p.text().unique(),
    stateId: p.text(),
    schoolNumber: p.text(),

    isRosteringRootOrg: p.boolean().notNull().default(false),
    rosteringEnded: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Constraints
    // - Ensure abbreviation format only contains letters and numbers
    p.check('orgs_abbreviation_format', sql`${table.abbreviation} ~ '^[A-Za-z0-9]+$'`),

    // Indexes
    // - Type lookups
    p.index('orgs_type_idx').on(table.orgType),

    // - Hierarchical lookups
    p.index('orgs_parent_idx').on(table.parentOrgId),
    p.index('orgs_parent_type_idx').on(table.parentOrgId, table.orgType),

    // - Name equality or prefix lookups
    p.index('orgs_name_lower_idx').on(sql`lower(${table.name})`),
    p.index('orgs_name_lower_pattern_idx').on(sql`lower(${table.name}) text_pattern_ops`),
  ],
);

export type Org = typeof orgs.$inferSelect;
export type NewOrg = typeof orgs.$inferInsert;
