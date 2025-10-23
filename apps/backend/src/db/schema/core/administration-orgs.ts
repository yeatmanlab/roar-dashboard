import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { administrations } from './administrations';
import { orgs } from './orgs';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * Administration Orgs Table
 *
 * Stores information about the relationship between administrations and orgs. Administrations can be assigned to one or
 * multiple orgs to enable the assignment of tasks to those orgs.
 */
export const administrationOrgs = db.table(
  'administration_orgs',
  {
    administrationId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => administrations.id),
    orgId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => orgs.id),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({
      name: 'administration_orgs_pkey',
      columns: [table.administrationId, table.orgId],
    }),
  ],
);

export type AdministrationOrg = typeof administrationOrgs.$inferSelect;
export type NewAdministrationOrg = typeof administrationOrgs.$inferInsert;
