import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { users } from './users';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * Administrations Table
 *
 * Stores information about administrations in the system. Administrations are made up of a set of task variants used
 * during the assessment of a student, and are assigned to entities such as orgs, classes, families, etc.
 */
export const administrations = db.table(
  'administrations',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    namePublic: p.text().notNull(),
    nameInternal: p.text().notNull(),
    description: p.text().notNull(),

    dateStart: p.date().notNull(),
    dateEnd: p.date().notNull(),

    isOrdered: p.boolean().notNull(),

    createdBy: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => users.id),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Name equality or prefix lookups
    p.index('administrations_name_public_lower_idx').on(sql`lower(${table.namePublic})`),
    p.index('administrations_name_internal_lower_idx').on(sql`lower(${table.nameInternal})`),

    // - Author lookups
    p.index('administrations_created_by_idx').on(table.createdBy),

    // - Date and date range lookups
    p.index('administrations_date_start_idx').on(table.dateStart),
    p.index('administrations_date_end_idx').on(table.dateEnd),
    p.index('administrations_date_start_end_idx').on(table.dateStart, table.dateEnd),

    // Constraints
    // - Date range must be valid
    p.check('administrations_date_start_end_check', sql`(${table.dateStart} < ${table.dateEnd})`),
  ],
);

export type Administration = typeof administrations.$inferSelect;
export type NewAdministration = typeof administrations.$inferInsert;
