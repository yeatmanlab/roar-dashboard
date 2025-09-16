import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
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
      .references((): AnyPgColumn => users.id),

    agreementVersionId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => agreementVersions.id),

    agreementTimestamp: p.timestamp({ withTimezone: true }).notNull(),

    ...timestamps,
  },
  (table) => [
    // Constraint
    // - User, agreement version and timestamp must be unique
    p
      .uniqueIndex('user_agreements_user_agreement_version_timestamp_uniqIdx')
      .on(table.userId, table.agreementVersionId, table.agreementTimestamp),

    // Indexes
    // - User lookups
    p.index('user_agreements_user_idx').on(table.userId, table.agreementVersionId),
  ],
);

export type UserAgreement = typeof userAgreements.$inferSelect;
export type NewUserAgreement = typeof userAgreements.$inferInsert;
