import { StatusCodes } from 'http-status-codes';
import type { GetTreeOptions, TreeNodeStats } from '../services/administration/administration.service';
import { AdministrationService } from '../services/administration/administration.service';
import { ReportService } from '../services/report/report.service';
import type {
  AdministrationAgreement,
  AdministrationAgreementsListQuery,
  AdministrationTaskVariantItem,
  AdministrationTaskVariantsListQuery,
  AdministrationTreeQuery,
  AdministrationsListQuery,
  Condition,
  CreateAdministrationRequest,
  OrganizationTreeNode,
  ProgressOverviewQuery,
  ProgressStudent,
  ProgressStudentsQuery,
  ReportTaskMetadata,
  ScoreOverviewQuery,
  StudentScoresQuery,
  StudentScoreRow,
  UpdateAdministrationRequest,
} from '@roar-dashboard/api-contract';
import type {
  AgreementWithVersion,
  AssignmentWithOptional,
  TaskVariantWithAssignment,
  TreeNode,
} from '../repositories/administration.repository';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { AuthContext } from '../types/auth-context';
import { transformAdministrationBase, transformAdministration } from './utils/administration.transform';

const administrationService = AdministrationService();
const reportService = ReportService();

/**
 * Type guard to check if an assignment has the pre-evaluated optional flag.
 * Used to distinguish supervised role responses (with optional boolean) from
 * supervisory role responses (with raw conditions).
 */
function hasOptionalFlag(assignment: TaskVariantWithAssignment['assignment']): assignment is AssignmentWithOptional {
  return 'optional' in assignment && typeof (assignment as AssignmentWithOptional).optional === 'boolean';
}

/**
 * Maps a TaskVariantWithAssignment (raw repository data) to the API response schema.
 *
 * Transforms the flat joined data from the repository into the nested structure
 * expected by the API contract (task and conditions as nested objects).
 *
 * For supervisory roles: conditions contains assigned_if and optional_if (raw conditions)
 * For supervised roles: conditions contains only optional (pre-evaluated boolean)
 *
 * @param item - The raw task variant data from the repository (variant, task, assignment)
 * @returns The API-formatted task variant item with nested task and conditions objects
 */
function toTaskVariantItem(item: TaskVariantWithAssignment): AdministrationTaskVariantItem {
  // Build the common base structure
  const base = {
    id: item.variant.id,
    name: item.variant.name,
    description: item.variant.description,
    orderIndex: item.assignment.orderIndex,
    task: {
      id: item.task.id,
      name: item.task.name,
      description: item.task.description,
      image: item.task.image,
      tutorialVideo: item.task.tutorialVideo,
    },
  };

  // Service guarantees: for supervised roles, assignment.optional is set;
  // for supervisory roles, assignment.optional is undefined
  if (hasOptionalFlag(item.assignment)) {
    // For supervised roles: return simplified conditions with pre-evaluated optional flag
    return {
      ...base,
      conditions: {
        optional: item.assignment.optional,
      },
    };
  }

  // For supervisory roles: return full conditions for client-side evaluation
  return {
    ...base,
    conditions: {
      assigned_if: item.assignment.conditionsAssignment as Condition | null,
      optional_if: item.assignment.conditionsRequirements as Condition | null,
    },
  };
}

/**
 * Maps an AgreementWithVersion (raw repository data) to the API response schema.
 *
 * Transforms the joined data from the repository into the structure expected
 * by the API contract.
 *
 * @param item - The raw agreement data from the repository (agreement and currentVersion)
 * @returns The API-formatted agreement item with nested currentVersion
 */
function toAgreementItem(item: AgreementWithVersion): AdministrationAgreement {
  return {
    id: item.agreement.id,
    name: item.agreement.name,
    agreementType: item.agreement.agreementType,
    currentVersion: item.currentVersion
      ? {
          id: item.currentVersion.id,
          locale: item.currentVersion.locale,
          githubFilename: item.currentVersion.githubFilename,
          githubOrgRepo: item.currentVersion.githubOrgRepo,
          githubCommitSha: item.currentVersion.githubCommitSha,
        }
      : null,
  };
}

/**
 * Builds a paginated response for sub-resource listing endpoints.
 */
function handleSubResourceResponse<T, R>(
  result: { items: T[]; totalItems: number },
  page: number,
  perPage: number,
  mapItem: (item: T) => R,
) {
  const items = result.items.map(mapItem);
  const totalPages = Math.ceil(result.totalItems / perPage);

  return {
    status: StatusCodes.OK as const,
    body: {
      data: {
        items,
        pagination: {
          page,
          perPage,
          totalItems: result.totalItems,
          totalPages,
        },
      },
    },
  };
}

/**
 * Handles errors for sub-resource listing endpoints.
 * Converts ApiError to typed error response or re-throws unknown errors.
 */
function handleSubResourceError(error: unknown) {
  if (error instanceof ApiError) {
    return toErrorResponse(error, [StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN, StatusCodes.INTERNAL_SERVER_ERROR]);
  }
  throw error;
}

/**
 * Maps a service-layer TreeNode (with optional stats) to the API contract's OrganizationTreeNode.
 *
 * @param node - The tree node from the service layer
 * @returns The API-formatted tree node
 */
function toTreeNode(node: TreeNode & { stats?: TreeNodeStats }): OrganizationTreeNode {
  const result: OrganizationTreeNode = {
    id: node.id,
    name: node.name,
    entityType: node.entityType,
    hasChildren: node.hasChildren,
  };

  if (node.stats) {
    result.stats = node.stats;
  }

  return result;
}

/**
 * Handles HTTP concerns for the /administrations endpoints.
 *
 * Responsible for transforming service results into ts-rest responses
 * and mapping known ApiError status codes to typed error responses.
 * Business logic and authorization live in AdministrationService.
 */
export const AdministrationsController = {
  /**
   * Get a single administration by ID.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Returns the base administration representation (no embeds).
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration to retrieve
   */
  get: async (authContext: AuthContext, administrationId: string) => {
    try {
      const administration = await administrationService.getById(authContext, administrationId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformAdministrationBase(administration),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.NOT_FOUND,
          StatusCodes.FORBIDDEN,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * List administrations with pagination, sorting, optional status filter, and embeds.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Transforms database entities to the API response format.
   *
   * @param authContext - User's authentication context
   * @param query - Query parameters (pagination, sorting, status filter, embed options)
   */
  list: async (authContext: AuthContext, query: AdministrationsListQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, embed, status } = query;

      const result = await administrationService.list(authContext, {
        page,
        perPage,
        sortBy,
        sortOrder,
        embed,
        ...(status && { status }),
      });

      // Transform to API response format
      const items = result.items.map(transformAdministration);

      const totalPages = Math.ceil(result.totalItems / perPage);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            items,
            pagination: {
              page,
              perPage,
              totalItems: result.totalItems,
              totalPages,
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
   * Get all assignees (districts, schools, classes, groups) for an administration.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration
   */
  getAssignees: async (authContext: AuthContext, administrationId: string) => {
    try {
      const result = await administrationService.getAssignees(authContext, administrationId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: result,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.NOT_FOUND,
          StatusCodes.FORBIDDEN,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * List task variants assigned to an administration.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Transforms database entities to the API response format.
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration
   * @param query - Query parameters (pagination, sorting)
   */
  listTaskVariants: async (
    authContext: AuthContext,
    administrationId: string,
    query: AdministrationTaskVariantsListQuery,
  ) => {
    try {
      const result = await administrationService.listTaskVariants(authContext, administrationId, query);
      return handleSubResourceResponse(result, query.page, query.perPage, toTaskVariantItem);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },

  /**
   * List agreements assigned to an administration.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Transforms database entities to the API response format.
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration
   * @param query - Query parameters (pagination, sorting, agreementType filter, locale)
   */
  listAgreements: async (
    authContext: AuthContext,
    administrationId: string,
    query: AdministrationAgreementsListQuery,
  ) => {
    try {
      const result = await administrationService.listAgreements(authContext, administrationId, query);
      const items = result.items.map(toAgreementItem);
      const totalPages = Math.ceil(result.totalItems / query.perPage);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            items,
            pagination: {
              page: query.page,
              perPage: query.perPage,
              totalItems: result.totalItems,
              totalPages,
            },
          },
        },
      };
    } catch (error) {
      return handleSubResourceError(error);
    }
  },

  /**
   * List paginated student progress for an administration.
   *
   * Delegates to ReportService for authorization and data assembly.
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration to report on
   * @param query - Query parameters (scope, filters, pagination, sort)
   */
  listProgressStudents: async (authContext: AuthContext, administrationId: string, query: ProgressStudentsQuery) => {
    try {
      const result = await reportService.listProgressStudents(authContext, administrationId, query);

      // Map service types to contract types for the response.
      // Shapes are structurally identical — this is a type boundary, not a data transformation.
      const tasks: ReportTaskMetadata[] = result.tasks;
      const items: ProgressStudent[] = result.items;

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            tasks,
            items,
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
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Get aggregated progress overview for an administration.
   *
   * Delegates to ReportService for authorization and aggregation.
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration to report on
   * @param query - Query parameters (scopeType, scopeId)
   */
  getProgressOverview: async (authContext: AuthContext, administrationId: string, query: ProgressOverviewQuery) => {
    try {
      const result = await reportService.getProgressOverview(authContext, administrationId, query);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: result,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Get aggregated score overview for an administration.
   *
   * Delegates to ReportService for authorization and aggregation.
   * The service's `ScoreOverviewResult` and the contract's `ScoreOverviewResponseSchema`
   * are kept structurally equivalent (same field names and types: totalStudents,
   * tasks[], computedAt) so the result can be returned directly without an explicit
   * transform. Type compatibility is enforced at compile time via TypeScript's
   * structural typing — see `report.types.ts` and the contract schema for the
   * source of truth on each side.
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration to report on
   * @param query - Query parameters (scopeType, scopeId, optional filter)
   */
  getScoreOverview: async (authContext: AuthContext, administrationId: string, query: ScoreOverviewQuery) => {
    try {
      const result = await reportService.getScoreOverview(authContext, administrationId, query);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: result,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Get one level of the organization tree for an administration.
   *
   * Delegates to AdministrationService for authorization, FGA scoping,
   * and tree node retrieval. Transforms the result to the paginated
   * tree node response format.
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration
   * @param query - Query parameters (pagination, embed, parentEntityType, parentEntityId)
   */
  getTree: async (authContext: AuthContext, administrationId: string, query: AdministrationTreeQuery) => {
    try {
      const { page, perPage } = query;

      const options: GetTreeOptions = {
        page,
        perPage,
        embed: query.embed,
      };
      if (query.parentEntityType) options.parentEntityType = query.parentEntityType;
      if (query.parentEntityId) options.parentEntityId = query.parentEntityId;

      const result = await administrationService.getTree(authContext, administrationId, options);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            items: result.items.map(toTreeNode),
            pagination: {
              page,
              perPage,
              totalItems: result.totalItems,
              totalPages: Math.ceil(result.totalItems / perPage),
            },
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.NOT_FOUND,
          StatusCodes.FORBIDDEN,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * List paginated per-student scores for an administration.
   *
   * Delegates to ReportService for authorization, score classification, and
   * per-row dedup across multi-variant tasks. The service returns
   * `ServiceStudentScoreRow` objects whose shape is structurally equivalent
   * to the contract's `StudentScoreRow`, so the result is returned directly.
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration to report on
   * @param query - Pagination, sort, filter, and scope parameters
   */
  listStudentScores: async (authContext: AuthContext, administrationId: string, query: StudentScoresQuery) => {
    try {
      const result = await reportService.listStudentScores(authContext, administrationId, query);

      // Service and contract types are structurally equivalent (same field
      // names: tasks[], items[], totalItems). The cast is implicit via TS structural
      // typing — see report.types.ts for the source of truth on each side.
      const tasks: ReportTaskMetadata[] = result.tasks;
      const items: StudentScoreRow[] = result.items;

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            tasks,
            items,
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
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Delete an administration by ID.
   *
   * Delegates to AdministrationService for authorization and deletion.
   * Returns 204 No Content on success.
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration to delete
   */
  delete: async (authContext: AuthContext, administrationId: string) => {
    try {
      await administrationService.deleteById(authContext, administrationId);

      return {
        status: StatusCodes.NO_CONTENT as const,
        body: undefined,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.NOT_FOUND,
          StatusCodes.FORBIDDEN,
          StatusCodes.CONFLICT,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Create a new administration.
   *
   * Delegates to AdministrationService for validation and creation.
   * Returns 201 Created with the created administration on success.
   *
   * @param authContext - User's authentication context
   * @param body - The create administration request body
   */
  create: async (authContext: AuthContext, body: CreateAdministrationRequest) => {
    try {
      const administration = await administrationService.create(authContext, body);

      return {
        status: StatusCodes.CREATED as const,
        body: {
          data: administration.id,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.FORBIDDEN,
          StatusCodes.CONFLICT,
          StatusCodes.UNPROCESSABLE_ENTITY,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Update an existing administration.
   *
   * Delegates to AdministrationService for validation and update.
   * Returns 200 OK with the updated administration on success.
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration to update
   * @param body - The update administration request body
   */
  update: async (authContext: AuthContext, administrationId: string, body: UpdateAdministrationRequest) => {
    try {
      const administration = await administrationService.update(authContext, administrationId, body);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformAdministrationBase(administration),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.CONFLICT,
          StatusCodes.UNPROCESSABLE_ENTITY,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
};
