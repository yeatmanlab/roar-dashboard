import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { users } from './users';
import { families } from './families';
import { userFamilyRoleEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * User Families Table
 *
 * Junction table for user membership in families (many-to-many relationship).
 * - One user can belong to multiple families (e.g., child in divorced family)
 * - One family can have multiple users (parents, children)
 *
 * @see {@link users} - The family member (cascade delete)
 * @see {@link families} - The family (restrict delete)
 */
export const userFamilies = db.table(
  'user_families',
  {
    userId: p
      .uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: p
      .uuid()
      .notNull()
      .references(() => families.id, { onDelete: 'restrict' }),

    role: userFamilyRoleEnum().notNull(),

    joinedOn: p
      .timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    leftOn: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({ name: 'user_families_pk', columns: [table.userId, table.familyId] }),

    // Indexes
    // - Lookups from either side
    p.index('user_families_family_idx').on(table.familyId),

    // Constraints
    // - Ensure leftOn is after joinedOn if leftOn is not null
    p.check(
      'user_families_membership_dates_valid',
      sql`${table.leftOn} IS NULL OR ${table.joinedOn} < ${table.leftOn}`,
    ),
  ],
);

export type UserFamily = typeof userFamilies.$inferSelect;
export type NewUserFamily = typeof userFamilies.$inferInsert;
