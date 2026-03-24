import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { users } from './users';
import { orgs } from './orgs';
import { userRoleEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * User Orgs Table
 *
 * Junction table for user membership in organizations (many-to-many relationship).
 * - One user can belong to multiple orgs (e.g., student in school and district)
 * - One org can have many users
 *
 * @see {@link users} - The organization member (cascade delete)
 * @see {@link orgs} - The organization (restrict delete)
 */
export const userOrgs = db.table(
  'user_orgs',
  {
    userId: p
      .uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: p
      .uuid()
      .notNull()
      .references(() => orgs.id, { onDelete: 'restrict' }),

    role: userRoleEnum().notNull(),

    enrollmentStart: p.timestamp({ withTimezone: true }).notNull(),
    enrollmentEnd: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({ name: 'user_orgs_pk', columns: [table.userId, table.orgId] }),

    // Indexes
    // - Lookup by org ID
    p.index('user_orgs_org_idx').on(table.orgId),

    // Constraints
    // - Ensure enrollmentEnd is after enrollmentStart if enrollmentEnd is not null
    p.check(
      'user_orgs_enrollment_dates_valid',
      sql`${table.enrollmentEnd} IS NULL OR ${table.enrollmentStart} < ${table.enrollmentEnd}`,
    ),
  ],
);

export type UserOrg = typeof userOrgs.$inferSelect;
export type NewUserOrg = typeof userOrgs.$inferInsert;
