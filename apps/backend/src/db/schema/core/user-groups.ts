import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { users } from './users';
import { groups } from './groups';
import { userRoleEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * User Groups Table
 *
 * Stores information about the membership of a user in a group (e.g. cohort, community, etc.). By definition, a single
 * user can be a member of multiple groups, and a single group can have multiple users.
 */
export const userGroups = db.table(
  'user_groups',
  {
    userId: p
      .uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: p
      .uuid()
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),

    role: userRoleEnum().notNull(),

    enrollmentStart: p.timestamp({ withTimezone: true }).notNull(),
    enrollmentEnd: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({ name: 'user_groups_pk', columns: [table.userId, table.groupId] }),

    // Indexes
    // - Lookup by group ID
    p.index('user_groups_group_idx').on(table.groupId),

    // Constraints
    // - Ensure enrollmentEnd is after enrollmentStart if enrollmentEnd is not null
    p.check(
      'user_groups_enrollment_dates_valid',
      sql`${table.enrollmentEnd} IS NULL OR ${table.enrollmentStart} < ${table.enrollmentEnd}`,
    ),
  ],
);

export type UserGroup = typeof userGroups.$inferSelect;
export type NewUserGroup = typeof userGroups.$inferInsert;
