import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';

const db = p.pgSchema('app');

/**
 * Tasks Bundles Table
 *
 * Stores information about task bundles in the system. Each task bundle is a collection of tasks available within the
 * ROAR platform, grouped together for easy access and assignment configuration.
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

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Slug lookups
    p.index('task_bundles_slug_lower_idx').on(sql`lower(${table.slug})`),
    // - Name lookups
    p.index('task_bundles_name_lower_idx').on(sql`lower(${table.name})`),
  ],
);

export type TaskBundle = typeof taskBundles.$inferSelect;
export type NewTaskBundle = typeof taskBundles.$inferInsert;
