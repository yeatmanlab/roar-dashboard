import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { users } from './users';

const db = p.pgSchema('app');

/**
 * User Research Exclusions Table
 *
 * Per-user research exclusion periods. When a user should be excluded from research
 * data for a specific time range, a record is created here. This is the per-user
 * counterpart to administration-level exclusion fields on the administrations table.
 *
 * @see {@link users} - The excluded user (cascade delete) and the excluding admin (restrict delete)
 */
export const userResearchExclusions = db.table(
  'user_research_exclusions',
  {
    userId: p
      .uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    excludeFrom: p.timestamp({ withTimezone: true }).notNull(),
    excludeUntil: p.timestamp({ withTimezone: true }).notNull(),

    excludedBy: p
      .uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    exclusionReason: p.text(),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({ columns: [table.userId, table.excludeFrom] }),

    // Constraints
    p.check('user_research_exclusions_dates_valid', sql`${table.excludeFrom} < ${table.excludeUntil}`),
  ],
);

export type UserResearchExclusion = typeof userResearchExclusions.$inferSelect;
export type NewUserResearchExclusion = typeof userResearchExclusions.$inferInsert;
