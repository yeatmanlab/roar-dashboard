import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { users } from './users';
import { families } from './families';
import { userRoleEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * User Families Table
 *
 * Stores information about the membership of a user in a family. By definition, a single user can be a member of
 * multiple families (depending on their user role) and a single family can have multiple users.
 */
export const userFamilies = db.table(
  'user_families',
  {
    userId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => users.id),
    familyId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => families.id),

    role: userRoleEnum().notNull(),

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
    p.index('user_families_user_idx').on(table.userId),
    p.index('user_families_family_idx').on(table.familyId),
  ],
);

export type UserFamily = typeof userFamilies.$inferSelect;
export type NewUserFamily = typeof userFamilies.$inferInsert;
