import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { administrations } from './administrations';
import { classes } from './classes';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * Administration Classes Table
 *
 * Stores information about the relationship between administrations and classes. Administrations can be assigned to one
 * or multiple classes to enable the assignment of tasks to those classes.
 */
export const administrationClasses = db.table(
  'administration_classes',
  {
    administrationId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => administrations.id),
    classId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => classes.id),

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
