import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { administrations } from './administrations';
import { groups } from './groups';

const db = p.pgSchema('app');

/**
 * Administration Groups Table
 *
 * Junction table linking administrations to groups. Defines which groups are assigned
 * to participate in an administration.
 *
 * - One administration can be assigned to multiple groups
 * - Users in assigned groups become eligible to take the administration's assessments
 * - Commonly used for ROAR at Home and cohort-based assessments
 *
 * @see {@link administrations} - The administration (cascade delete)
 * @see {@link groups} - The assigned group (restrict delete)
 * @see {@link administrationOrgs} - Alternative: assign to orgs
 * @see {@link administrationClasses} - Alternative: assign to classes
 */
export const administrationGroups = db.table(
  'administration_groups',
  {
    administrationId: p
      .uuid()
      .notNull()
      .references(() => administrations.id, { onDelete: 'cascade' }),
    groupId: p
      .uuid()
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({
      name: 'administration_groups_pkey',
      columns: [table.administrationId, table.groupId],
    }),
  ],
);

export type AdministrationGroup = typeof administrationGroups.$inferSelect;
export type NewAdministrationGroup = typeof administrationGroups.$inferInsert;
