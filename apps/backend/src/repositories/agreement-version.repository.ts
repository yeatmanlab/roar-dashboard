import { and, asc, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AgreementType } from '../enums/agreement-type.enum';
import type * as CoreDbSchema from '../db/schema/core';
import type { AgreementVersion } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import { agreements, agreementVersions } from '../db/schema';
import { BaseRepository } from './base.repository';

const registrationAgreementVersionSelection = {
  agreementId: agreements.id,
  agreementVersionId: agreementVersions.id,
  agreementType: agreements.agreementType,
  name: agreements.name,
  locale: agreementVersions.locale,
  isCurrent: agreementVersions.isCurrent,
  githubFilename: agreementVersions.githubFilename,
  githubOrgRepo: agreementVersions.githubOrgRepo,
  githubCommitSha: agreementVersions.githubCommitSha,
};

export interface RegistrationAgreementVersion {
  agreementId: string;
  agreementVersionId: string;
  agreementType: AgreementType;
  name: string;
  locale: string;
  isCurrent: boolean;
  githubFilename: string;
  githubOrgRepo: string;
  githubCommitSha: string;
}

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

  /**
   * Return current signable registration agreements available in a locale.
   *
   * @param locale - Locale to match exactly
   * @param agreementTypes - Signable agreement types to include
   * @returns Current matching agreement versions ordered by agreement name and id
   */
  async listCurrentForRegistration(
    locale: string,
    agreementTypes: readonly AgreementType[],
  ): Promise<RegistrationAgreementVersion[]> {
    if (agreementTypes.length === 0) return [];

    return this.db
      .select(registrationAgreementVersionSelection)
      .from(agreementVersions)
      .innerJoin(agreements, eq(agreementVersions.agreementId, agreements.id))
      .where(
        and(
          eq(agreementVersions.isCurrent, true),
          eq(agreementVersions.locale, locale),
          inArray(agreements.agreementType, agreementTypes),
        ),
      )
      .orderBy(asc(agreements.name), asc(agreements.id));
  }

  /**
   * Return registration candidate metadata for submitted version ids, including stale versions.
   *
   * @param versionIds - Submitted agreement-version ids
   * @returns Matching versions; unknown ids are omitted
   */
  async getRegistrationCandidatesByIds(versionIds: string[]): Promise<RegistrationAgreementVersion[]> {
    if (versionIds.length === 0) return [];

    return this.db
      .select(registrationAgreementVersionSelection)
      .from(agreementVersions)
      .innerJoin(agreements, eq(agreementVersions.agreementId, agreements.id))
      .where(inArray(agreementVersions.id, versionIds));
  }
}
