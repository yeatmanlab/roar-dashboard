import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as CoreDbSchema from '../db/schema/core';
import { CoreDbClient } from '../db/clients';
import { userAgreements, type UserAgreement } from '../db/schema';
import { BaseRepository } from './base.repository';

/**
 * UserAgreement Repository
 *
 * Provides data access methods for the user_agreements table.
 * Extends BaseRepository for standard CRUD operations.
 *
 * Note: This repository does not implement access control methods.
 * Authorization for user agreements happens in the service layer via UserRepository
 * (family relationship validation).
 */
export class UserAgreementRepository extends BaseRepository<UserAgreement, typeof userAgreements> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, userAgreements);
  }

  /**
   * Find an existing user agreement record for a specific user and agreement version.
   *
   * Used to detect duplicate consent submissions before creating a new record.
   *
   * @param userId - The user whose consent is being checked
   * @param agreementVersionId - The agreement version to check for
   * @returns The existing user agreement record, or null if none exists
   */
  async findByUserIdAndAgreementVersionId(userId: string, agreementVersionId: string): Promise<UserAgreement | null> {
    const [existing] = await this.db
      .select()
      .from(userAgreements)
      .where(and(eq(userAgreements.userId, userId), eq(userAgreements.agreementVersionId, agreementVersionId)))
      .limit(1);
    return existing ?? null;
  }
}
