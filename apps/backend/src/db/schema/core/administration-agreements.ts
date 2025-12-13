import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { administrations } from './administrations';
import { agreements } from './agreements';

const db = p.pgSchema('app');

/**
 * Administration Agreements Table
 *
 * Junction table linking agreements to administrations. Defines which legal agreements
 * participants must sign before taking assessments in an administration.
 *
 * - One administration can require multiple agreements (e.g., TOS + consent + assent)
 * - Agreements can be added mid-administration if policies change
 *
 * @see {@link administrations} - The administration requiring these agreements (cascade delete)
 * @see {@link agreements} - The agreement being required (restrict delete)
 */
export const administrationAgreements = db.table(
  'administration_agreements',
  {
    administrationId: p
      .uuid()
      .notNull()
      .references(() => administrations.id, { onDelete: 'cascade' }),
    agreementId: p
      .uuid()
      .notNull()
      .references(() => agreements.id, { onDelete: 'restrict' }),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({
      name: 'administration_agreements_pkey',
      columns: [table.administrationId, table.agreementId],
    }),
  ],
);

export type AdministrationAgreement = typeof administrationAgreements.$inferSelect;
export type NewAdministrationAgreement = typeof administrationAgreements.$inferInsert;
