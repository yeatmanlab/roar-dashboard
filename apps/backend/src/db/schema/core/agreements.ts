import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { agreementTypeEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Agreements Table
 *
 * Stores information about agreements in the system.
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
    requiresMajorityAge: p.boolean().notNull().default(false),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Name equality or prefix lookups
    p.index('agreements_name_lower_idx').on(sql`lower(${table.name})`),

    // - Type equality lookups
    p.index('agreements_type_idx').on(table.agreementType),
  ],
);

export type Agreement = typeof agreements.$inferSelect;
export type NewAgreement = typeof agreements.$inferInsert;
