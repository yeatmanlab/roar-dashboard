import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { administrations } from './administrations';
import { taskVariants } from './task-variants';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * Administration Task Variants Table
 *
 * Stores information about administration task variants in the system. Administration task variant entries record which
 * task variants are used within a specific administration.
 */
export const administrationTaskVariants = db.table(
  'administration_task_variants',
  {
    administrationId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => administrations.id),
    taskVariantId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => taskVariants.id),

    orderIndex: p.integer().notNull(),

    conditionsAssignment: p.jsonb(),
    conditionsRequirements: p.jsonb(),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({
      name: 'administration_task_variants_pkey',
      columns: [table.administrationId, table.taskVariantId],
    }),

    // Indexes
    // - Lookup by administration ID, sorted by order index
    p
      .index('administration_task_variants_administration_id_order_index_idx')
      .on(table.administrationId, table.orderIndex),
    // - Lookup by task variant ID
    p.index('administration_task_variants_task_variant_id_idx').on(table.taskVariantId),
  ],
);

export type AdministrationTaskVariant = typeof administrationTaskVariants.$inferSelect;
export type NewAdministrationTaskVariant = typeof administrationTaskVariants.$inferInsert;
