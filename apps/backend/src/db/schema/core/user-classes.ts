import * as p from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { users } from './users';
import { classes } from './classes';
import { userRoleEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * User Classes Table
 *
 * Stores information about the membership of a user in a class. By definition, a single user can be a member of
 * multiple classes, and a single class can have multiple users.
 */
export const userClasses = db.table(
  'user_classes',
  {
    userId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => users.id),
    classId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => classes.id),

    role: userRoleEnum().notNull(),

    enrollmentStart: p.timestamp({ withTimezone: true }).notNull(),
    enrollmentEnd: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Prevent duplicate memberships
    p.primaryKey({ name: 'user_classes_pk', columns: [table.userId, table.classId] }),

    // Lookups from either side
    p.index('user_classes_user_idx').on(table.userId),
    p.index('user_classes_class_idx').on(table.classId),
  ],
);

export type UserClass = typeof userClasses.$inferSelect;
export type NewUserClass = typeof userClasses.$inferInsert;
