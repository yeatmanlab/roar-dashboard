import * as p from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { users } from './users';
import { orgs } from './orgs';
import { userRoleEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Users Orgs Table
 *
 * Stores information about the membership of a user in an org (e.g. district, school, etc.). By definition, a single
 * user can be a member of multiple orgs, and a single org can have multiple users.
 */
export const usersOrgs = db.table(
  'users_orgs',
  {
    userId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => users.id),
    orgId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => orgs.id),

    role: userRoleEnum().notNull(),

    enrollmentStart: p.timestamp({ withTimezone: true }).notNull(),
    enrollmentEnd: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Prevent duplicate memberships
    p.primaryKey({ name: 'users_orgs_pk', columns: [table.userId, table.orgId] }),

    // Lookups from either side
    p.index('users_orgs_user_idx').on(table.userId),
    p.index('users_orgs_org_idx').on(table.orgId),
  ],
);

export type UserOrg = typeof usersOrgs.$inferSelect;
export type NewUserOrg = typeof usersOrgs.$inferInsert;
