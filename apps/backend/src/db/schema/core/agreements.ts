import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { agreementTypeEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Agreements Table
 *
 * Stores information about legal agreements in the system (e.g., terms of service, privacy policy,
 * consent forms). Each agreement can have multiple versions across different locales.
 *
 * @see {@link agreementVersions} - Versioned content of this agreement
 * @see {@link userAgreements} - Records of users who have signed versions of this agreement
 * @see {@link administrationAgreements} - Administrations that require this agreement
 */
export const agreements = db.table(
  'agreements',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    name: p.text().notNull(),

    agreementType: agreementTypeEnum().notNull(),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Name equality or prefix lookups
    p.index('agreements_name_lower_idx').on(sql`lower(${table.name})`),
    p.index('agreements_name_lower_pattern_idx').on(sql`lower(${table.name}) text_pattern_ops`),

    // - Type equality lookups
    p.index('agreements_type_idx').on(table.agreementType),
  ],
);

export type Agreement = typeof agreements.$inferSelect;
export type NewAgreement = typeof agreements.$inferInsert;
