import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_TREE_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;
const TREE_LEVEL_PER_PAGE = 100;

/**
 * Map a backend `OrganizationTreeNode` to the PvTreeTable node shape the
 * CardAdministration tree consumes:
 *
 * - `entityType` → `orgType` (the values already match `SINGULAR_ORG_TYPES`)
 * - the student-bucketed `stats.assignment` → the `{ assigned, started, completed }`
 *   shape the progress chart (`setProgressChartData`) expects
 * - a `Loading…` placeholder child when the node has children, so PvTreeTable
 *   renders an expander and lazy expansion can swap in the real children.
 *
 * @param {object} apiNode - An `OrganizationTreeNode` from the tree endpoint.
 * @returns {object} A PvTreeTable node.
 */
export function toTreeTableNode(apiNode) {
  const node = {
    key: apiNode.id,
    data: {
      id: apiNode.id,
      name: apiNode.name,
      orgType: apiNode.entityType,
      ...(apiNode.stats
        ? {
            stats: {
              assignment: {
                assigned: apiNode.stats.assignment.studentsAssigned,
                started: apiNode.stats.assignment.studentsStarted,
                completed: apiNode.stats.assignment.studentsCompleted,
              },
            },
          }
        : {}),
    },
  };

  if (apiNode.hasChildren) {
    node.children = [{ key: `${apiNode.id}-placeholder`, data: { name: 'Loading...', isPlaceholder: true } }];
  }

  return node;
}

/**
 * Fetch one level of an administration's org tree from
 * `GET /administrations/:id/tree`, following pagination so a level with many
 * entities is returned in full. Pass a parent to fetch that node's children;
 * omit it for the root level (districts + groups). Returns PvTreeTable nodes.
 *
 * @param {string} administrationId - The administration UUID.
 * @param {{ parentEntityType?: string, parentEntityId?: string }} [parent] - The parent node to expand, if any.
 * @returns {Promise<Array>} Mapped tree-table nodes for the requested level.
 */
export async function fetchAdministrationTreeLevel(administrationId, parent = {}) {
  const client = getRoarApiClient();
  const apiNodes = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await client.administrations.getTree({
      params: { id: administrationId },
      query: {
        page,
        perPage: TREE_LEVEL_PER_PAGE,
        embed: 'stats',
        ...(parent.parentEntityType ? { parentEntityType: parent.parentEntityType } : {}),
        ...(parent.parentEntityId ? { parentEntityId: parent.parentEntityId } : {}),
      },
    });

    if (result.status !== StatusCodes.OK) {
      const error = new Error(`Failed to fetch administration tree with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    }

    apiNodes.push(...result.body.data.items);
    totalPages = result.body.data.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return apiNodes.map(toTreeTableNode);
}

/**
 * Administration org-tree query (root level).
 *
 * Loads the root entities (districts and groups) of an administration's org
 * tree from `GET /administrations/:id/tree`. Child levels are fetched lazily on
 * node expansion via `fetchAdministrationTreeLevel`.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} administrationId - The administration UUID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} TanStack query resolving to the root tree-table nodes.
 */
const useAdministrationTreeQuery = (administrationId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(administrationId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATION_TREE_QUERY_KEY, administrationId],
    queryFn: () => fetchAdministrationTreeLevel(toValue(administrationId)),
    ...options,
    enabled: isQueryEnabled,
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useAdministrationTreeQuery;
