import * as p from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { taskBundles } from './task-bundles';
import { taskVariants } from './task-variants';

const db = p.pgSchema('app');

/**
 * Tasks Bundle Variants Table
 *
 * Stores information about task bundle variants in the system. Each task bundle contains a collection of task variants
 * ready to be assigned.
 */

export const taskBundleVariants = db.table(
  'task_bundle_variants',
  {
    taskBundleId: p
      .uuid()
      .references((): AnyPgColumn => taskBundles.id)
      .notNull(),

    taskVariantId: p
      .uuid()
      .references((): AnyPgColumn => taskVariants.id)
      .notNull(),

    sortOrder: p.integer().notNull(),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({
      name: 'task_bundle_variants_task_bundle_id_task_variant_id_pkey',
      columns: [table.taskBundleId, table.taskVariantId],
    }),

    // Indexes
    // - Lookup by task bundle ID
    p.index('task_bundle_variants_task_bundle_id_idx').on(table.taskBundleId),
    // - Lookup by task variant ID
    p.index('task_bundle_variants_task_variant_id_idx').on(table.taskVariantId),
    // - Lookup by bundle id and sorted by sort order
    p.index('task_bundle_variants_task_bundle_id_sort_order_idx').on(table.taskBundleId, table.sortOrder),
  ],
);

export type TaskBundleVariant = typeof taskBundleVariants.$inferSelect;
export type NewTaskBundleVariant = typeof taskBundleVariants.$inferInsert;
