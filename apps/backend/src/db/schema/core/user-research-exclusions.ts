import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { users } from './users';

const db = p.pgSchema('app');

/**
 * User Research Exclusions Table
 *
 * Tracks per-user research exclusion periods. This is the user-level counterpart
 * to the administration-level `excludedFromResearch` columns on the `administrations` table.
 *
 * Each row represents a time window during which a user's data should be excluded
 * from research analysis. Multiple non-overlapping exclusion periods per user are supported.
 *
 * @see {@link users} - The user being excluded
 */
export const userResearchExclusions = db.table(
  'user_research_exclusions',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
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
    exclusionReason: p.text().notNull(),
    ...timestamps,
  },
  (table) => [
    p.check('user_research_exclusions_date_range_check', sql`${table.excludeFrom} < ${table.excludeUntil}`),
    p.index('user_research_exclusions_user_id_idx').on(table.userId),
  ],
);

export type UserResearchExclusion = typeof userResearchExclusions.$inferSelect;
export type NewUserResearchExclusion = typeof userResearchExclusions.$inferInsert;
