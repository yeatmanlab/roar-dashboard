import { StatusCodes } from 'http-status-codes';
import type { AuthContext } from '../../types/auth-context';
import type { AgreementType as AgreementTypeValue } from '../../enums/agreement-type.enum';
import type { AgreementVersion } from '../../db/schema';
import type { PaginatedResult } from '../../repositories/base.repository';
import type { AgreementEmbedOptionType } from '../../enums/agreement-embed-option.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { AgreementEmbedOption } from '../../enums/agreement-embed-option.enum';
import { AgreementType } from '../../enums/agreement-type.enum';
import { AgreementRepository } from '../../repositories/agreement.repository';
import type { AgreementWithCurrentVersion } from '../../repositories/agreement.repository';
import { AgreementVersionRepository } from '../../repositories/agreement-version.repository';
import type { RegistrationAgreementVersion } from '../../repositories/agreement-version.repository';

export const REGISTRATION_AGREEMENT_TYPES = [AgreementType.CONSENT, AgreementType.TOS] as const;

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
  agreementType?: AgreementTypeValue | undefined;
}

/**
 * Result of fetching agreement version content.
 */
export interface VersionContentResult {
  id: string;
  agreementId: string;
  locale: string;
  content: string;
  githubCommitSha: string;
  createdAt: Date;
}

export interface RegistrationAgreementResult {
  agreementId: string;
  agreementVersionId: string;
  agreementType: AgreementTypeValue;
  name: string;
  locale: string;
  content: string;
}

/** Base URL for fetching raw content from GitHub */
const GITHUB_USER_CONTENT_BASE_URL = 'https://raw.githubusercontent.com';

/** GitHub raw content URL timeout in milliseconds */
const GITHUB_FETCH_TIMEOUT_MS = 10_000;

const DEFAULT_REGISTRATION_LOCALE = 'en-US';

/** Successful and in-flight fetches keyed by immutable GitHub content URL. */
const githubContentCache = new Map<string, Promise<string>>();

/**
 * Fetches raw file content from GitHub using the raw.githubusercontent.com URL.
 *
 * @param orgRepo - GitHub org/repo (e.g., "yeatmanlab/roar-legal")
 * @param commitSha - The commit SHA to pin the content to
 * @param filename - The file path within the repository
 * @returns The raw file content as a string
 * @throws {ApiError} If the fetch fails or returns non-200
 */
async function fetchGithubContent(orgRepo: string, commitSha: string, filename: string): Promise<string> {
  const url = `${GITHUB_USER_CONTENT_BASE_URL}/${orgRepo}/${commitSha}/${filename}`;
  const cachedContent = githubContentCache.get(url);
  if (cachedContent) return cachedContent;

  const contentPromise = (async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        context: { url, status: response.status, message: 'Failed to fetch agreement content from GitHub' },
      });
    }

    const content = await response.text();
    if (!content) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { url, message: 'Agreement content file is empty or missing' },
      });
    }

    return content;
  })();

  githubContentCache.set(url, contentPromise);

  try {
    return await contentPromise;
  } catch (error) {
    githubContentCache.delete(url);
    throw error;
  }
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
  agreementVersionRepository = new AgreementVersionRepository(),
  fetchContent = fetchGithubContent,
}: {
  agreementRepository?: AgreementRepository;
  agreementVersionRepository?: AgreementVersionRepository;
  fetchContent?: typeof fetchGithubContent;
} = {}) {
  /** Resolves the current adult-signable agreement documents for public registration. */
  async function getRegistrationAgreements(locale: string): Promise<RegistrationAgreementResult[]> {
    let localizedVersions: RegistrationAgreementVersion[];
    let fallbackVersions: RegistrationAgreementVersion[];
    let requiredAgreementIds: string[];

    try {
      [localizedVersions, fallbackVersions, requiredAgreementIds] = await Promise.all([
        agreementVersionRepository.listCurrentForRegistration(locale, REGISTRATION_AGREEMENT_TYPES),
        locale === DEFAULT_REGISTRATION_LOCALE
          ? Promise.resolve([])
          : agreementVersionRepository.listCurrentForRegistration(
              DEFAULT_REGISTRATION_LOCALE,
              REGISTRATION_AGREEMENT_TYPES,
            ),
        agreementVersionRepository.listRequiredRegistrationAgreementIds(REGISTRATION_AGREEMENT_TYPES),
      ]);
    } catch (error) {
      logger.error({ err: error, context: { locale } }, 'Failed to query registration agreements');
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { locale },
        cause: error,
      });
    }

    if (requiredAgreementIds.length === 0) {
      logger.error({ context: { locale } }, 'No registration agreements are configured');
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL,
        context: { locale },
      });
    }

    const versionsByAgreementId = new Map(fallbackVersions.map((version) => [version.agreementId, version]));
    for (const version of localizedVersions) versionsByAgreementId.set(version.agreementId, version);

    const missingAgreementIds = requiredAgreementIds.filter((agreementId) => !versionsByAgreementId.has(agreementId));
    if (missingAgreementIds.length > 0) {
      logger.error(
        { context: { locale, fallbackLocale: DEFAULT_REGISTRATION_LOCALE, missingAgreementIds } },
        'Registration agreements are missing current localized and fallback versions',
      );
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL,
        context: { locale, missingAgreementIds },
      });
    }

    const requiredAgreementIdSet = new Set(requiredAgreementIds);
    const versions = [...versionsByAgreementId.values()]
      .filter(({ agreementId }) => requiredAgreementIdSet.has(agreementId))
      .sort((left, right) => left.name.localeCompare(right.name) || left.agreementId.localeCompare(right.agreementId));

    try {
      return await Promise.all(
        versions.map(async (version) => ({
          agreementId: version.agreementId,
          agreementVersionId: version.agreementVersionId,
          agreementType: version.agreementType,
          name: version.name,
          locale: version.locale,
          content: await fetchContent(version.githubOrgRepo, version.githubCommitSha, version.githubFilename),
        })),
      );
    } catch (error) {
      logger.error({ err: error, context: { locale } }, 'Failed to resolve registration agreement content');
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        context: { locale },
        cause: error,
      });
    }
  }

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

  /**
   * Get the content of a specific agreement version.
   *
   * Validates that the version belongs to the specified agreement, fetches the
   * markdown content from GitHub, and returns it alongside version metadata.
   *
   * Authorization behavior:
   * - All authenticated users can view any agreement version content
   *
   * @param authContext - User's auth context
   * @param agreementId - The agreement the version must belong to
   * @param versionId - The version to fetch content for
   * @returns Version metadata with raw markdown content
   * @throws {ApiError} NOT_FOUND if agreement or version not found, or version doesn't belong to agreement
   * @throws {ApiError} INTERNAL_SERVER_ERROR if GitHub fetch fails
   */
  async function getVersionContent(
    authContext: AuthContext,
    agreementId: string,
    versionId: string,
  ): Promise<VersionContentResult> {
    const { userId } = authContext;

    try {
      // Verify agreement exists
      const agreement = await agreementRepository.getById({ id: agreementId });
      if (!agreement) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, agreementId },
        });
      }

      // Look up version, verifying it belongs to this agreement
      const version = await agreementRepository.getVersionByIdForAgreement(agreementId, versionId);
      if (!version) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, agreementId, versionId },
        });
      }

      // Fetch content from GitHub
      const content = await fetchContent(version.githubOrgRepo, version.githubCommitSha, version.githubFilename);

      return {
        id: version.id,
        agreementId: version.agreementId,
        locale: version.locale,
        content,
        githubCommitSha: version.githubCommitSha,
        createdAt: version.createdAt,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, agreementId, versionId } },
        'Failed to get agreement version content',
      );

      throw new ApiError('Failed to get agreement version content', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        context: { userId, agreementId, versionId },
        cause: error,
      });
    }
  }

  return { getRegistrationAgreements, list, getVersionContent };
}
