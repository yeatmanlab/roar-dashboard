import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base.repository';
import type { InvitationCode } from '../db/schema';
import { invitationCodes } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';

/**
 * InvitationCodeRepository
 *
 * Handles database operations for invitation codes.
 * Extends BaseRepository for standard CRUD operations.
 * Uses CoreDbClient by default, but accepts a custom DB client for testing.
 */
export class InvitationCodeRepository extends BaseRepository<InvitationCode, typeof invitationCodes> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, invitationCodes);
  }

  /**
   * Look up an invitation code by its `code` value, only returning rows that are currently valid.
   *
   * Filters by:
   * - `code` matches exactly (case-sensitive — codes are opaque)
   * - `validFrom <= NOW()`
   * - `validTo >= NOW() OR validTo IS NULL`
   *
   * Used by `POST /v1/families/:familyId/users` to resolve the caller-supplied
   * activation code to a group before enrolling a child. Returns `null` for
   * unknown or expired codes so the caller can produce a 422.
   *
   * @param code - The invitation code value (e.g. `'ABC123'`)
   * @returns The invitation code row if valid, or null
   */
  async findValidByCode(code: string): Promise<InvitationCode | null> {
    const now = sql`NOW()`;

    const result = await this.db
      .select()
      .from(invitationCodes)
      .where(
        and(
          eq(invitationCodes.code, code),
          lte(invitationCodes.validFrom, now),
          or(gte(invitationCodes.validTo, now), isNull(invitationCodes.validTo)),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Get the latest valid invitation code for a group.
   *
   * Filters by:
   * - groupId matches
   * - validFrom <= NOW()
   * - validTo >= NOW() OR validTo IS NULL (no expiration)
   *
   * Orders by created_at DESC and returns the most recent one.
   *
   * @param groupId - Group UUID
   * @returns The latest valid invitation code or null if none found
   */
  async getLatestValidByGroupId(groupId: string): Promise<InvitationCode | null> {
    const now = sql`NOW()`;

    const result = await this.db
      .select()
      .from(invitationCodes)
      .where(
        and(
          eq(invitationCodes.groupId, groupId),
          lte(invitationCodes.validFrom, now),
          or(gte(invitationCodes.validTo, now), isNull(invitationCodes.validTo)),
        ),
      )
      .orderBy(desc(invitationCodes.createdAt))
      .limit(1);

    return result[0] ?? null;
  }
}
