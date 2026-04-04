import { StatusCodes } from 'http-status-codes';
import type {
  AgreementsListQuery,
  Agreement as ContractAgreement,
  AgreementVersionBase,
  AgreementVersionContentParams,
} from '@roar-dashboard/api-contract';
import type { AgreementVersion } from '../db/schema';
import type { AgreementWithEmbeds } from '../services/agreement/agreement.service';
import { AgreementService } from '../services/agreement/agreement.service';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { AuthContext } from '../types/auth-context';

const agreementService = AgreementService();

/**
 * Maps a database AgreementVersion to the API response schema.
 *
 * @param version - The database AgreementVersion entity
 * @returns The API-formatted version object
 */
function transformAgreementVersion(version: AgreementVersion): AgreementVersionBase {
  return {
    id: version.id,
    locale: version.locale,
    githubFilename: version.githubFilename,
    githubOrgRepo: version.githubOrgRepo,
    githubCommitSha: version.githubCommitSha,
    createdAt: version.createdAt.toISOString(),
  };
}

/**
 * Maps an AgreementWithEmbeds (raw service data) to the API response schema.
 *
 * @param item - The agreement with optional embedded versions
 * @returns The API-formatted agreement object
 */
function transformAgreement(item: AgreementWithEmbeds): ContractAgreement {
  const result: ContractAgreement = {
    id: item.id,
    name: item.name,
    agreementType: item.agreementType,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
    currentVersion: item.currentVersion ? transformAgreementVersion(item.currentVersion) : null,
  };

  if (item.versions !== undefined) {
    result.versions = item.versions.map(transformAgreementVersion);
  }

  return result;
}

export const AgreementsController = {
  /**
   * List agreements.
   *
   * Delegates to AgreementService for retrieval, transforms the result to the API
   * response format, and maps errors to typed HTTP responses.
   *
   * @param authContext - User's authentication context
   * @param query - Validated query parameters (pagination, sort, locale, embed, filter)
   */
  list: async (authContext: AuthContext, query: AgreementsListQuery) => {
    try {
      const result = await agreementService.list(authContext, {
        page: query.page,
        perPage: query.perPage,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        locale: query.locale,
        embed: query.embed,
        ...(query.agreementType && { agreementType: query.agreementType }),
      });

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            items: result.items.map(transformAgreement),
            pagination: {
              page: query.page,
              perPage: query.perPage,
              totalItems: result.totalItems,
              totalPages: Math.ceil(result.totalItems / query.perPage),
            },
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },

  /**
   * Get agreement version content.
   *
   * Fetches the raw markdown content for a specific agreement version from GitHub.
   * Sets aggressive caching headers since content is immutable (tied to a commit SHA).
   *
   * @param authContext - User's authentication context
   * @param params - Path parameters (agreementId, versionId)
   */
  getVersionContent: async (authContext: AuthContext, params: AgreementVersionContentParams) => {
    try {
      const result = await agreementService.getVersionContent(authContext, params.agreementId, params.versionId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            id: result.id,
            agreementId: result.agreementId,
            locale: result.locale,
            content: result.content,
            githubCommitSha: result.githubCommitSha,
            createdAt: result.createdAt.toISOString(),
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [StatusCodes.NOT_FOUND, StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },
};
