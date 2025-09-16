import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { users } from './users';
import { administrations } from './administrations';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * User Assignments Table
 *
 * Stores information about the relationship between users and administrations. User assignments tie users to
 * administrations.
 */
export const userAssignments = db.table(
  'user_assignments',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    administrationId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => administrations.id),

    userId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => users.id),

    startedAt: p.timestamp({ withTimezone: true }),
    completedAt: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Constraints
    // - Prevent duplicate assignments for a user/administration pair
    p.uniqueIndex('user_assignments_user_administration_uniqIdx').on(table.userId, table.administrationId),

    // Indexes
    // - Lookups from either side
    p.index('user_assignments_user_idx').on(table.userId),
    p.index('user_assignments_administration_idx').on(table.administrationId),
  ],
);

export type UserAssignment = typeof userAssignments.$inferSelect;
export type NewUserAssignment = typeof userAssignments.$inferInsert;
