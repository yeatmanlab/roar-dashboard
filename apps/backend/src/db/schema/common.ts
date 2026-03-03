import * as p from 'drizzle-orm/pg-core';
import { customType } from 'drizzle-orm/pg-core';

export const timestamps = {
  updatedAt: p.timestamp({ withTimezone: true }),
  createdAt: p.timestamp({ withTimezone: true }).defaultNow().notNull(),
};

/**
 * Custom ltree type for hierarchical path storage.
 *
 * ltree is a PostgreSQL extension that provides a data type for representing
 * labels of data stored in a hierarchical tree-like structure. It uses materialized
 * paths - storing the full path from root to node as a dot-separated string.
 *
 * The ltree type is currently not natively supported by Drizzle.
 * @see https://github.com/drizzle-team/drizzle-orm/issues/671
 *
 * @example
 * // District -> School hierarchy
 * 'district_550e8400_e29b_41d4_a716_446655440000'
 * 'district_550e8400_e29b_41d4_a716_446655440000.school_a1b2c3d4_5e6f_7a8b_9c0d_1e2f3a4b5c6d'
 *
 * @see https://www.postgresql.org/docs/current/ltree.html
 */
export const ltree = customType<{ data: string }>({
  dataType() {
    return 'ltree';
  },
});
