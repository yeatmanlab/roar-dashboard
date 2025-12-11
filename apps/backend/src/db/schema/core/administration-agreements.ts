import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { administrations } from './administrations';
import { agreements } from './agreements';

const db = p.pgSchema('app');

/**
 * Administration Agreements Table
 *
 * Stores information about the relationship between administrations and agreements. Administrations are usually
 * assigned a single agreement at the time of creation, but this table allows for multiple agreements to be assigned
 * to a single administration in case agreements are updated during the course of an administration.
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
