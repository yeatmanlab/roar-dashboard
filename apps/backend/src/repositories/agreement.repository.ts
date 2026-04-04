import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AgreementSortFieldType } from '@roar-dashboard/api-contract';
import type { AgreementType } from '../enums/agreement-type.enum';
import type * as CoreDbSchema from '../db/schema/core';
import { SortOrder } from '@roar-dashboard/api-contract';
import { CoreDbClient } from '../db/clients';
import { agreements, agreementVersions, type Agreement, type AgreementVersion } from '../db/schema';
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
   * Look up a single agreement version by ID, verifying it belongs to the specified agreement.
   *
   * @param agreementId - The agreement the version must belong to
   * @param versionId - The version ID to look up
   * @returns The version record, or null if not found or agreementId doesn't match
   */
  async getVersionByIdForAgreement(agreementId: string, versionId: string): Promise<AgreementVersion | null> {
    const [version] = await this.db
      .select()
      .from(agreementVersions)
      .where(and(eq(agreementVersions.id, versionId), eq(agreementVersions.agreementId, agreementId)))
      .limit(1);

    return version ?? null;
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
