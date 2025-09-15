import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';

const db = p.pgSchema('app');

/**
 * Families Table
 *
 * Stores information about families in the system. Families are used by ROAR outside of the traditional educational
 * context, for example to group users in a family for the purpose of at-home assessments.
 */

export const families = db.table('families', {
  id: p
    .uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  locationAddressLine1: p.text(),
  locationAddressLine2: p.text(),
  locationCity: p.text(),
  locationStateProvince: p.text(),
  locationPostalCode: p.text(),
  locationCountry: p.varchar({ length: 2 }),
  locationLatLong: p.point(),

  rosteringEnded: p.timestamp({ withTimezone: true }),

  ...timestamps,
});

export type Family = typeof families.$inferSelect;
export type NewFamily = typeof families.$inferInsert;
