import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { agreements } from './agreements';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * Agreement Versions Table
 *
 * Stores information about agreement versions in the system. Each agreement exists in different versions and those are
 * recorded here to track changes over time.
 */
export const agreementVersions = db.table(
  'agreement_versions',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    agreementId: p
      .uuid()
      .references((): AnyPgColumn => agreements.id)
      .notNull(),

    isCurrent: p.boolean().notNull(),
    locale: p.varchar({ length: 6 }).notNull(),

    githubFilename: p.text().notNull(),
    githubOrgRepo: p.text().notNull(),
    githubCommitSha: p.bigint({ mode: 'bigint' }).notNull(),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Agreement ID lookups
    p.index('agreement_versions_agreement_id_idx').on(table.agreementId),

    // - Current version lookups
    p.index('agreement_versions_current_idx').on(table.isCurrent, table.agreementId),

    // - Current version locale lookups
    p.index('agreement_versions_current_locale_idx').on(table.isCurrent, table.locale, table.agreementId),
  ],
);

export type AgreementVersion = typeof agreementVersions.$inferSelect;
export type NewAgreementVersion = typeof agreementVersions.$inferInsert;
