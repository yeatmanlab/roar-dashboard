import { and, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import { CoreDbClient } from '../db/clients';
import { invitationCodes, type InvitationCode } from '../db/schema';

/**
 * InvitationCodeRepository
 *
 * Handles database operations for invitation codes.
 */
export class InvitationCodeRepository {
  private db = CoreDbClient;

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
    const now = new Date();

    const result = await this.db
      .select()
      .from(invitationCodes)
      .where(
        and(
          eq(invitationCodes.groupId, groupId),
          lte(invitationCodes.validFrom, now),
          or(gte(invitationCodes.validTo, now), sql`${invitationCodes.validTo} IS NULL`),
        ),
      )
      .orderBy(desc(invitationCodes.createdAt))
      .limit(1);

    return result[0] ?? null;
  }
}
