import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { agreements } from './agreements';

const db = p.pgSchema('app');

/**
 * Agreement Versions Table
 *
 * Stores information about agreement versions in the system. Each agreement can exist in multiple
 * versions across different locales. Version content is stored in GitHub and referenced here.
 *
 * @see {@link agreements} - The parent agreement this version belongs to
 * @see {@link userAgreements} - Records of users who have signed this version
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
      .references(() => agreements.id, { onDelete: 'restrict' })
      .notNull(),

    isCurrent: p.boolean().notNull(),
    locale: p.varchar({ length: 2 }).notNull(),

    githubFilename: p.text().notNull(),
    githubOrgRepo: p.text().notNull(),
    githubCommitSha: p.bigint({ mode: 'bigint' }).notNull(),

    ...timestamps,
  },
  (table) => [
    // Constraints
    // - Unique constraint to ensure a single current version per agreement / locale
    p
      .uniqueIndex('agreement_versions_current_unique_idx')
      .on(table.agreementId, table.locale)
      .where(sql`${table.isCurrent} = true`),

    // - Unique constraint to prevent duplicate versions for the same agreement / locale / commit SHA
    p.uniqueIndex('agreement_versions_identity_unique_idx').on(table.agreementId, table.locale, table.githubCommitSha),

    // - Ensure correct ISO 639-1 locale codes (2-letter)
    p.check('agreement_versions_locale_format', sql`${table.locale} ~ '^[a-z]{2}$'`),

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
