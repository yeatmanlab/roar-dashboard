import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as CoreDbSchema from '../db/schema/core';
import { CoreDbClient } from '../db/clients';
import { agreementVersions, type AgreementVersion } from '../db/schema';
import { BaseRepository } from './base.repository';

/**
 * AgreementVersion Repository
 *
 * Provides data access methods for the agreement_versions table.
 * Extends BaseRepository for standard CRUD operations.
 *
 * Agreement versions represent specific versions of legal agreements (e.g., Terms of Service v2.0).
 * Each version has a locale, content reference (GitHub), and tracks whether it's the current version.
 */
export class AgreementVersionRepository extends BaseRepository<AgreementVersion, typeof agreementVersions> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, agreementVersions);
  }
}
