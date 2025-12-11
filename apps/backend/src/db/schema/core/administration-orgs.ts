import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { administrations } from './administrations';
import { orgs } from './orgs';

const db = p.pgSchema('app');

/**
 * Administration Orgs Table
 *
 * Junction table linking administrations to organizations. Defines which orgs are assigned
 * to participate in an administration.
 *
 * - One administration can be assigned to multiple orgs
 * - Users in assigned orgs become eligible to take the administration's assessments
 * - Can target any org level (district, school, etc.)
 *
 * @see {@link administrations} - The administration (cascade delete)
 * @see {@link orgs} - The assigned organization (restrict delete)
 * @see {@link administrationClasses} - Alternative: assign to specific classes
 * @see {@link administrationGroups} - Alternative: assign to groups
 */
export const administrationOrgs = db.table(
  'administration_orgs',
  {
    administrationId: p
      .uuid()
      .notNull()
      .references(() => administrations.id, { onDelete: 'cascade' }),
    orgId: p
      .uuid()
      .notNull()
      .references(() => orgs.id, { onDelete: 'restrict' }),
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
