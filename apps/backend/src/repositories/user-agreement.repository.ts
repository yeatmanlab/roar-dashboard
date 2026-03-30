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
}
