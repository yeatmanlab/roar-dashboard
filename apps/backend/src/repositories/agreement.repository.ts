import { and, asc, count, desc, eq, inArray, notInArray } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AgreementSortFieldType } from '@roar-dashboard/api-contract';
import type { AgreementType } from '../enums/agreement-type.enum';
import type * as CoreDbSchema from '../db/schema/core';
import { SortOrder } from '@roar-dashboard/api-contract';
import { CoreDbClient } from '../db/clients';
import { agreements, agreementVersions, userAgreements, type Agreement, type AgreementVersion } from '../db/schema';
import { AgreementType as AgreementTypeEnum } from '../enums/agreement-type.enum';
import { BaseRepository, type PaginatedResult } from './base.repository';
import { BasePaginatedQueryParams } from './interfaces/base.repository.interface';

/**
 * Agreement with its current version for the requested locale.
 * currentVersion is null when no current version exists for the locale,
 * though this should not occur in production data.
 */
export interface AgreementWithCurrentVersion extends Agreement {
  currentVersion: AgreementVersion | null;
}

/**
 * Options for listing agreements.
 */
export interface ListAgreementsOptions extends BasePaginatedQueryParams {
  locale: string;
  agreementType?: AgreementType;
}

/**
 * Explicit mapping from API sort field names to agreements table columns.
 * Ensures only valid columns are used for sorting, even if API validation is bypassed.
 */
const AGREEMENT_SORT_COLUMNS: Record<AgreementSortFieldType, Column> = {
  name: agreements.name,
  agreementType: agreements.agreementType,
  createdAt: agreements.createdAt,
  updatedAt: agreements.updatedAt,
};

/**
 * Agreement Repository
 *
 * Provides data access methods for the agreements table.
 * Extends BaseRepository for standard CRUD operations and adds list methods
 * for the GET /v1/agreements endpoint.
 *
 * Agreements represent legal documents (e.g., Terms of Service, Consent, Assent) that
 * users must agree to. Each agreement can have multiple versions across different locales.
 */
export class AgreementRepository extends BaseRepository<Agreement, typeof agreements> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, agreements);
  }

  /**
   * List all agreements with their current version for the requested locale.
   *
   * Uses an INNER JOIN on agreement_versions to simultaneously:
   * 1. Filter to only agreements that have a current version in the requested locale
   * 2. Fetch the current version metadata for the response
   *
   * @param options - Pagination, sorting, locale, and optional agreementType filter
   * @returns Paginated result with agreements and their current versions
   */
  async listAll(options: ListAgreementsOptions): Promise<PaginatedResult<AgreementWithCurrentVersion>> {
    const { page, perPage, orderBy, locale, agreementType } = options;
    const offset = (page - 1) * perPage;

    // INNER JOIN condition: current version for the requested locale.
    // The INNER JOIN both fetches the version AND filters out agreements with no version
    // for the locale, so currentVersion is always non-null in the result.
    const versionJoinCondition = and(
      eq(agreementVersions.agreementId, agreements.id),
      eq(agreementVersions.isCurrent, true),
      eq(agreementVersions.locale, locale),
    );

    const whereClause = agreementType ? eq(agreements.agreementType, agreementType) : undefined;

    // Count query
    const countResult = await this.db
      .select({ count: count() })
      .from(agreements)
      .innerJoin(agreementVersions, versionJoinCondition)
      .where(whereClause);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Resolve sort column, falling back to createdAt for unknown fields.
    // Cast is safe: the API contract validates sortBy before it reaches the repository.
    const sortField = orderBy?.field as AgreementSortFieldType | undefined;
    const sortColumn = (sortField && AGREEMENT_SORT_COLUMNS[sortField]) || agreements.createdAt;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    // Data query: INNER JOIN fetches and filters in a single round-trip
    const dataResult = await this.db
      .select({
        agreement: agreements,
        currentVersion: agreementVersions,
      })
      .from(agreements)
      .innerJoin(agreementVersions, versionJoinCondition)
      .where(whereClause)
      .orderBy(primaryOrder, asc(agreements.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => ({
        ...row.agreement,
        currentVersion: row.currentVersion,
      })),
      totalItems,
    };
  }

  /**
   * Get the version ID for a specific agreement version, verifying it belongs to the agreement.
   *
   * @param agreementId - The agreement the version should belong to
   * @param versionId - The version to look up
   * @returns The agreement version if found and belongs to the agreement, null otherwise
   */
  async getVersionByIdForAgreement(agreementId: string, versionId: string): Promise<AgreementVersion | null> {
    const result = await this.db
      .select()
      .from(agreementVersions)
      .where(and(eq(agreementVersions.id, versionId), eq(agreementVersions.agreementId, agreementId)))
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Find TOS agreements that the user has not yet signed (any current version).
   *
   * Returns all current locale variants for each unsigned TOS agreement so the
   * frontend can present the appropriate locale without an extra round-trip.
   *
   * Cross-locale satisfaction: if a user has signed ANY current version of a TOS
   * agreement (regardless of locale), the entire agreement is considered satisfied.
   *
   * @param userId - The user to check unsigned agreements for
   * @returns Array of unsigned TOS agreements with their current versions
   */
  async getUnsignedTosAgreements(
    userId: string,
  ): Promise<Array<{ agreement: Agreement; currentVersions: AgreementVersion[] }>> {
    // Subquery: agreement IDs where the user has signed any current version
    const signedAgreementIds = this.db
      .select({ agreementId: agreementVersions.agreementId })
      .from(userAgreements)
      .innerJoin(agreementVersions, eq(userAgreements.agreementVersionId, agreementVersions.id))
      .where(and(eq(userAgreements.userId, userId), eq(agreementVersions.isCurrent, true)));

    // Find TOS agreements NOT in the signed set, then fetch their current versions
    const unsignedAgreementRows = await this.db
      .select()
      .from(agreements)
      .where(and(eq(agreements.agreementType, AgreementTypeEnum.TOS), notInArray(agreements.id, signedAgreementIds)));

    if (unsignedAgreementRows.length === 0) {
      return [];
    }

    // Bulk-fetch all current versions for the unsigned agreements
    const unsignedIds = unsignedAgreementRows.map((a) => a.id);
    const currentVersions = await this.db
      .select()
      .from(agreementVersions)
      .where(and(inArray(agreementVersions.agreementId, unsignedIds), eq(agreementVersions.isCurrent, true)))
      .orderBy(asc(agreementVersions.agreementId), asc(agreementVersions.locale));

    // Group versions by agreement ID using a Map for O(n) distribution
    const versionsMap = new Map<string, AgreementVersion[]>();
    for (const version of currentVersions) {
      const existing = versionsMap.get(version.agreementId);
      if (existing) {
        existing.push(version);
      } else {
        versionsMap.set(version.agreementId, [version]);
      }
    }

    return unsignedAgreementRows.map((agreement) => ({
      agreement,
      currentVersions: versionsMap.get(agreement.id) ?? [],
    }));
  }

  /**
   * Fetch all versions for the given agreement IDs, grouped by agreementId.
   *
   * Used for embed resolution when ?embed=versions is requested.
   * Versions are sorted by createdAt descending (most recent first).
   *
   * @param ids - Array of agreement IDs to fetch versions for
   * @returns Map of agreementId to its versions array
   */
  async getVersionsByAgreementIds(ids: string[]): Promise<Map<string, AgreementVersion[]>> {
    if (ids.length === 0) return new Map();

    const versions = await this.db
      .select()
      .from(agreementVersions)
      .where(inArray(agreementVersions.agreementId, ids))
      .orderBy(asc(agreementVersions.agreementId), desc(agreementVersions.createdAt));

    const map = new Map<string, AgreementVersion[]>();
    for (const version of versions) {
      const existing = map.get(version.agreementId);
      if (existing) {
        existing.push(version);
      } else {
        map.set(version.agreementId, [version]);
      }
    }
    return map;
  }
}
