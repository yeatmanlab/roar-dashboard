import { StatusCodes } from 'http-status-codes';
import type { AuthContext } from '../../types/auth-context';
import type { AgreementType } from '../../enums/agreement-type.enum';
import type { AgreementVersion } from '../../db/schema';
import type { PaginatedResult } from '../../repositories/base.repository';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { AgreementRepository, type AgreementWithCurrentVersion } from '../../repositories/agreement.repository';

/**
 * Options for embedding agreement versions.
 */
const AgreementEmbedOption = {
  VERSIONS: 'versions',
} as const;

/**
 * Type for agreement embed options.
 */
export type AgreementEmbedOptionType = (typeof AgreementEmbedOption)[keyof typeof AgreementEmbedOption];

/**
 * Agreement with optional embedded versions array.
 */
export interface AgreementWithEmbeds extends AgreementWithCurrentVersion {
  versions?: AgreementVersion[];
}

/**
 * Options for listing agreements.
 */
export interface AgreementsListOptions {
  page: number;
  perPage: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  locale: string;
  embed: AgreementEmbedOptionType[];
  agreementType?: AgreementType | undefined;
}

/**
 * AgreementService
 *
 * Provides agreement-related business logic.
 * Follows the factory pattern with dependency injection.
 *
 * @param params - Configuration object containing optional repository instances
 * @returns Object with agreement service methods
 */
export function AgreementService({
  agreementRepository = new AgreementRepository(),
}: {
  agreementRepository?: AgreementRepository;
} = {}) {
  /**
   * List agreements accessible to all authenticated users.
   *
   * Returns only agreements that have a current version in the requested locale.
   * If ?embed=versions is requested, all historical versions are resolved and attached.
   *
   * Authorization behavior:
   * - All authenticated users see the same system-wide agreements list
   * - No org-level scoping; agreements are global resources used in consent workflows
   *
   * @param authContext - User's auth context
   * @param options - Pagination, sorting, locale, embed, and optional type filter
   * @returns Paginated result with agreements and their current versions
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function list(
    authContext: AuthContext,
    options: AgreementsListOptions,
  ): Promise<PaginatedResult<AgreementWithEmbeds>> {
    const { userId } = authContext;

    try {
      const result = await agreementRepository.listAll({
        page: options.page,
        perPage: options.perPage,
        orderBy: { field: options.sortBy, direction: options.sortOrder },
        locale: options.locale,
        ...(options.agreementType && { agreementType: options.agreementType }),
      });

      if (result.items.length === 0 || !options.embed.includes(AgreementEmbedOption.VERSIONS)) {
        return result;
      }

      // Resolve versions embed: bulk-fetch then attach via Map for O(n) distribution
      const ids = result.items.map((item) => item.id);
      const versionsMap = await agreementRepository.getVersionsByAgreementIds(ids);

      return {
        items: result.items.map((item) => ({
          ...item,
          versions: versionsMap.get(item.id) ?? [],
        })),
        totalItems: result.totalItems,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId } }, 'Failed to list agreements');

      throw new ApiError('Failed to list agreements', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }
  }

  return { list };
}
