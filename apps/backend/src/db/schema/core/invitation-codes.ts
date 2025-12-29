import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { groups } from './groups';

const db = p.pgSchema('app');

/**
 * Invitation Codes Table
 *
 * Stores information about invitation codes in the system. Invitation codes are used exclusively for users to join
 * groups. Each invitation code is associated with a specific group and has an expiration date.
 *
 * @see {@link groups} - Referenced via groupId
 */
export const invitationCodes = db.table(
  'invitation_codes',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    groupId: p
      .uuid()
      .references((): AnyPgColumn => groups.id, { onDelete: 'cascade' })
      .notNull(),

    code: p.text().unique().notNull(),

    validFrom: p.timestamp({ withTimezone: true }).notNull(),
    validTo: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    p.check('invitation_codes_valid_range', sql`${table.validTo} IS NULL OR ${table.validTo} > ${table.validFrom}`),
    p.index('invitation_codes_group_idx').on(table.groupId),
  ],
);

export type InvitationCode = typeof invitationCodes.$inferSelect;
export type NewInvitationCode = typeof invitationCodes.$inferInsert;
