import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { users } from './users';
import { agreementVersions } from './agreement-versions';

const db = p.pgSchema('app');

/**
 * User Agreements Table
 *
 * Stores information about the agreements a user has signed. By definition, a single user will have multiple signed
 * agreements and a single agreement can have multiple users assigned to it.
 */
export const userAgreements = db.table(
  'user_agreements',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    userId: p
      .uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    agreementVersionId: p
      .uuid()
      .notNull()
      .references(() => agreementVersions.id, { onDelete: 'restrict' }),

    agreementTimestamp: p.timestamp({ withTimezone: true }).notNull(),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - User lookups
    p.index('user_agreements_user_idx').on(table.userId),
    p.index('user_agreements_user_agreement_idx').on(table.userId, table.agreementVersionId),
    p.index('user_agreements_agreement_version_idx').on(table.agreementVersionId),
  ],
);

export type UserAgreement = typeof userAgreements.$inferSelect;
export type NewUserAgreement = typeof userAgreements.$inferInsert;
