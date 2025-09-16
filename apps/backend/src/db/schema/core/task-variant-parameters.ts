import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { AnyPgColumn } from 'drizzle-orm/pg-core';
import { taskVariants } from './task-variants';

const db = p.pgSchema('app');

/**
 * Task Variant Parameters Table
 *
 * Stores information about task variant parameters in the system. Each task variant parameter is a configuration
 * parameter of a task variant that can be used to create assessments. A single task variant usually has multiple
 * parameters, each with different values.
 */

export const taskVariantParameters = db.table(
  'task_variant_parameters',
  {
    taskVariantId: p
      .uuid()
      .references((): AnyPgColumn => taskVariants.id)
      .notNull()
      .primaryKey(),

    name: p.text().notNull(),
    value: p.jsonb().notNull(),

    ...timestamps,
  },
  (table) => [
    // Constraints
    // - Parameter name should be unique per variant Id
    p.index('task_variant_parameters_name_variant_id_idx').on(table.taskVariantId, table.name),
  ],
);

export type TaskVariantParameter = typeof taskVariantParameters.$inferSelect;
export type NewTaskVariantParameter = typeof taskVariantParameters.$inferInsert;
