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
import { AgreementRepository } from '../../repositories/agreement.repository';
import type { AgreementWithCurrentVersion } from '../../repositories/agreement.repository';
import { AgreementVersionRepository } from '../../repositories/agreement-version.repository';
import type { RegistrationAgreementVersion } from '../../repositories/agreement-version.repository';
import { DEFAULT_REGISTRATION_LOCALE, REGISTRATION_AGREEMENT_TYPES } from '../../constants/registration-agreements';

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

/** Maximum raw agreement document size accepted from GitHub. */
const GITHUB_CONTENT_MAX_BYTES = 1024 * 1024;

/** Maximum immutable GitHub documents retained by one backend process. */
const GITHUB_CONTENT_CACHE_MAX_ENTRIES = 256;

/**
 * Successful and in-flight fetches keyed by GitHub content URL.
 *
 * A process-wide cache is safe because every URL includes an immutable commit
 * SHA. The entry cap bounds memory even as new agreement versions are added.
 */
interface GithubContentCacheEntry {
  promise: Promise<string>;
  settled: boolean;
}

const githubContentCache = new Map<string, GithubContentCacheEntry>();

/**
 * Evict oldest settled entries while preserving request coalescing for in-flight fetches.
 *
 * @param maxEntries - Target cache size
 * @returns Nothing
 */
function trimGithubContentCache(maxEntries: number): void {
  while (githubContentCache.size > maxEntries) {
    const settledEntry = [...githubContentCache].find(([, entry]) => entry.settled);
    if (!settledEntry) return;
    githubContentCache.delete(settledEntry[0]);
  }
}

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
  if (cachedContent) return cachedContent.promise;

  const contentPromise = (async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        context: { url, status: response.status },
      });
    }

    const content = await readResponseTextWithLimit(response, url, GITHUB_CONTENT_MAX_BYTES);
    if (!content) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { url },
      });
    }

    return content;
  })();

  trimGithubContentCache(GITHUB_CONTENT_CACHE_MAX_ENTRIES - 1);
  const cacheEntry = { promise: contentPromise, settled: false };
  githubContentCache.set(url, cacheEntry);

  try {
    const content = await contentPromise;
    cacheEntry.settled = true;
    trimGithubContentCache(GITHUB_CONTENT_CACHE_MAX_ENTRIES);
    return content;
  } catch (error) {
    if (githubContentCache.get(url) === cacheEntry) githubContentCache.delete(url);
    throw error;
  }
}

/**
 * Read a fetch response without allowing unbounded external content into memory.
 *
 * @param response - Successful GitHub response
 * @param url - Source URL included in internal error context
 * @param maxBytes - Maximum encoded response size
 * @returns Decoded UTF-8 response text
 * @throws {ApiError} When the declared or streamed content exceeds the limit
 */
async function readResponseTextWithLimit(response: Response, url: string, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throwGithubContentTooLarge(url, maxBytes);
  }

  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throwGithubContentTooLarge(url, maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Throw the standard external-content size error.
 *
 * @param url - GitHub content URL
 * @param maxBytes - Configured response ceiling
 * @returns Never returns
 * @throws {ApiError} Always throws EXTERNAL_SERVICE_FAILED
 */
function throwGithubContentTooLarge(url: string, maxBytes: number): never {
  throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
    context: { url, maxBytes },
  });
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
  /**
   * Prefer requested-locale versions and fill per-agreement gaps from the fallback locale.
   *
   * @param localizedVersions - Current versions in the requested locale
   * @param fallbackVersions - Current versions in the fallback locale
   * @returns One preferred version per agreement
   */
  function selectRegistrationAgreementVersions(
    localizedVersions: RegistrationAgreementVersion[],
    fallbackVersions: RegistrationAgreementVersion[],
  ): RegistrationAgreementVersion[] {
    const versionsByAgreementId = new Map(fallbackVersions.map((version) => [version.agreementId, version]));
    for (const version of localizedVersions) versionsByAgreementId.set(version.agreementId, version);

    return [...versionsByAgreementId.values()].sort(
      (left, right) => left.name.localeCompare(right.name) || left.agreementId.localeCompare(right.agreementId),
    );
  }

  /**
   * Resolve the current registration agreement versions for a locale.
   *
   * Missing translations fall back per agreement to the current en-US version.
   *
   * @param locale - Requested registration locale
   * @returns Current adult-signable agreement versions for the localized set
   * @throws {ApiError} INTERNAL_SERVER_ERROR when configuration is missing or the query fails
   */
  async function getRegistrationAgreementVersions(locale: string): Promise<RegistrationAgreementVersion[]> {
    let localizedVersions: RegistrationAgreementVersion[];
    let fallbackVersions: RegistrationAgreementVersion[];

    try {
      [localizedVersions, fallbackVersions] = await Promise.all([
        agreementVersionRepository.listCurrentForRegistration(locale, REGISTRATION_AGREEMENT_TYPES),
        locale === DEFAULT_REGISTRATION_LOCALE
          ? Promise.resolve([])
          : agreementVersionRepository.listCurrentForRegistration(
              DEFAULT_REGISTRATION_LOCALE,
              REGISTRATION_AGREEMENT_TYPES,
            ),
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

    const versions = selectRegistrationAgreementVersions(localizedVersions, fallbackVersions);
    if (versions.length === 0) {
      logger.error({ context: { locale } }, 'No registration agreements are configured');
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL,
        context: { locale },
      });
    }

    return versions;
  }

  /**
   * Resolve current adult-signable agreement documents for public registration.
   *
   * @param locale - Preferred locale for agreement content
   * @returns Registration agreements with inline content
   * @throws {ApiError} When agreement content cannot be resolved
   */
  async function getRegistrationAgreements(locale: string): Promise<RegistrationAgreementResult[]> {
    const versions = await getRegistrationAgreementVersions(locale);

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

  return { getRegistrationAgreementVersions, getRegistrationAgreements, list, getVersionContent };
}
