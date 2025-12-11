import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { administrations } from './administrations';
import { classes } from './classes';

const db = p.pgSchema('app');

/**
 * Administration Classes Table
 *
 * Junction table linking administrations to classes. Defines which classes are assigned
 * to participate in an administration.
 *
 * - One administration can be assigned to multiple classes
 * - Students in assigned classes become eligible to take the administration's assessments
 *
 * @see {@link administrations} - The administration (cascade delete)
 * @see {@link classes} - The assigned class (restrict delete)
 * @see {@link administrationOrgs} - Alternative: assign to entire orgs
 * @see {@link administrationGroups} - Alternative: assign to groups
 */
export const administrationClasses = db.table(
  'administration_classes',
  {
    administrationId: p
      .uuid()
      .notNull()
      .references(() => administrations.id, { onDelete: 'cascade' }),
    classId: p
      .uuid()
      .notNull()
      .references(() => classes.id, { onDelete: 'restrict' }),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({
      name: 'administration_classes_pkey',
      columns: [table.administrationId, table.classId],
    }),
  ],
);

export type AdministrationClass = typeof administrationClasses.$inferSelect;
export type NewAdministrationClass = typeof administrationClasses.$inferInsert;
