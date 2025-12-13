import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { users } from './users';

const db = p.pgSchema('app');

/**
 * Administrations Table
 *
 * Stores information about administrations in the system. An administration defines a collection of
 * task variants (assessments) that students will complete during a specific time period. Administrations
 * are assigned to entities such as orgs, classes, families, etc.
 *
 * @see {@link users} - Referenced via createdBy
 * @see {@link administrationTaskVariants} - Junction table defining which task variants are in this administration
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

    dateStart: p.timestamp({ withTimezone: true }).notNull(),
    dateEnd: p.timestamp({ withTimezone: true }).notNull(),

    isOrdered: p.boolean().notNull(),

    createdBy: p
      .uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Name equality or prefix lookups
    p.index('administrations_name_public_lower_idx').on(sql`lower(${table.namePublic})`),
    p.index('administrations_name_public_lower_pattern_idx').on(sql`lower(${table.namePublic}) text_pattern_ops`),
    p.index('administrations_name_internal_lower_idx').on(sql`lower(${table.nameInternal})`),
    p.index('administrations_name_internal_lower_pattern_idx').on(sql`lower(${table.nameInternal}) text_pattern_ops`),

    // - Author lookups
    p.index('administrations_created_by_idx').on(table.createdBy),

    // - Date and date range lookups
    p.index('administrations_date_end_idx').on(table.dateEnd),
    p.index('administrations_date_range_idx').on(table.dateStart, table.dateEnd),

    // Constraints
    // - Names must be unique
    p.uniqueIndex('administrations_name_internal_unique_idx').on(sql`lower(${table.nameInternal})`),
    // - Date range must be valid
    p.check('administrations_date_start_end_check', sql`(${table.dateStart} < ${table.dateEnd})`),
  ],
);

export type Administration = typeof administrations.$inferSelect;
export type NewAdministration = typeof administrations.$inferInsert;
