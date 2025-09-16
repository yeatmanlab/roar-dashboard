import * as p from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
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
      .references((): AnyPgColumn => users.id),
    groupId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => groups.id),

    role: userRoleEnum().notNull(),

    enrollmentStart: p.timestamp({ withTimezone: true }).notNull(),
    enrollmentEnd: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Prevent duplicate memberships
    p.primaryKey({ name: 'user_groups_pk', columns: [table.userId, table.groupId] }),

    // Lookups from either side
    p.index('user_groups_user_idx').on(table.userId),
    p.index('user_groups_group_idx').on(table.groupId),
  ],
);

export type UserGroup = typeof userGroups.$inferSelect;
export type NewUserGroup = typeof userGroups.$inferInsert;
