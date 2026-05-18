import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { users } from './users';

const db = p.pgSchema('app');

/**
 * Families Table
 *
 * Stores information about families in the system. Families are used by ROAR outside of the traditional
 * educational context, for example to group users in a family for at-home assessments.
 *
 * Note: This table intentionally has no `name` field. Families are identified by their UUID and
 * are typically referenced through the `userFamilies` junction table. Location fields are optional
 * and used for geographic analysis of at-home assessment participation.
 *
 * `createdBy` references the caretaker that registered the family via `POST /v1/families`. It is
 * nullable so that families created by admin tooling (or rows seeded before the column was added)
 * remain valid; the partial unique index in `families_created_by_uniq_idx` enforces "one family per
 * caretaker" only when `createdBy IS NOT NULL`.
 *
 * @see {@link userFamilies} - Junction table linking users to families
 */

export const families = db.table(
  'families',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    createdBy: p.uuid().references((): AnyPgColumn => users.id, { onDelete: 'restrict' }),

    locationAddressLine1: p.text(),
    locationAddressLine2: p.text(),
    locationCity: p.text(),
    locationStateProvince: p.text(),
    locationPostalCode: p.text(),
    locationCountry: p.varchar({ length: 2 }),
    locationLatLong: p.point(),

    rosteringEnded: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // One family per caretaker — the partial index fires only when createdBy is set,
    // so families seeded without a creator (e.g. by admin tools) remain valid.
    p
      .uniqueIndex('families_created_by_uniq_idx')
      .on(table.createdBy)
      .where(sql`${table.createdBy} IS NOT NULL`),
  ],
);

export type Family = typeof families.$inferSelect;
export type NewFamily = typeof families.$inferInsert;
