import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as CoreDbSchema from '../db/schema/core';
import { CoreDbClient } from '../db/clients';
import { agreements, type Agreement } from '../db/schema';
import { BaseRepository } from './base.repository';

/**
 * Agreement Repository
 *
 * Provides data access methods for the agreements table.
 * Extends BaseRepository for standard CRUD operations.
 *
 * Agreements represent legal documents (e.g., Terms of Service, Consent, Assent) that users must agree to.
 * Each agreement has a type (tos, consent, assent) and can have multiple versions.
 */
export class AgreementRepository extends BaseRepository<Agreement, typeof agreements> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, agreements);
  }
}
