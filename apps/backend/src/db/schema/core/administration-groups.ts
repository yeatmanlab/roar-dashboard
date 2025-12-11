import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { administrations } from './administrations';
import { groups } from './groups';

const db = p.pgSchema('app');

/**
 * Administration Groups Table
 *
 * Stores information about the relationship between administrations and groups. Administrations can be assigned to one
 * or multiple groups to enable the assignment of tasks to those groups.
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
