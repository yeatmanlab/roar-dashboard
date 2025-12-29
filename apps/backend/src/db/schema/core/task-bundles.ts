import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';

const db = p.pgSchema('app');

/**
 * Task Bundles Table
 *
 * Stores predefined collections of task variants that can be assigned together. Bundles provide
 * a convenient way to group related assessments for common use cases (e.g., "Grade 3 Reading Battery",
 * "Phonics Assessment Suite").
 *
 * @see {@link taskBundleVariants} - Junction table linking task variants to this bundle
 */

export const taskBundles = db.table(
  'task_bundles',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    slug: p.text().unique().notNull(),
    name: p.text().notNull(),
    description: p.text().notNull(),
    image: p.text(),

    ...timestamps,
  },
  (table) => [
    // Constraints
    // - Ensure slug format (alphanumeric, dashes, underscores)
    p.check('tasks_slug_format', sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),

    // Indexes
    // - Slug lookups
    p.index('task_bundles_slug_lower_idx').on(sql`lower(${table.slug})`),

    // - Name lookups
    p.index('task_bundles_name_lower_idx').on(sql`lower(${table.name})`),
  ],
);

export type TaskBundle = typeof taskBundles.$inferSelect;
export type NewTaskBundle = typeof taskBundles.$inferInsert;
