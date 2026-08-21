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
const DEFAULT_ROOT_PER_PAGE = 10;

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
 * Fetch a non-root level of an administration's org tree — a parent node's
 * children — from `GET /administrations/:id/tree`, following pagination so a level
 * with many entities is returned in full. The root level is not fetched here (it is
 * server-paginated via `fetchAdministrationTreeRootPage`), so `parent` is required.
 * Returns PvTreeTable nodes.
 *
 * @param {string} administrationId - The administration UUID.
 * @param {{ parentEntityType: string, parentEntityId: string }} parent - The node whose children to fetch.
 * @returns {Promise<Array>} Mapped tree-table nodes for the requested level.
 */
export async function fetchAdministrationTreeLevel(administrationId, { parentEntityType, parentEntityId }) {
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
        parentEntityType,
        parentEntityId,
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
 * Fetch a single page of the administration's root org-tree level from
 * `GET /administrations/:id/tree` (no parent — districts + groups). Unlike
 * `fetchAdministrationTreeLevel`, this does NOT page-walk: the root level is
 * paginated by PvTreeTable's native paginator, so the query fetches exactly one
 * server page and surfaces the pagination envelope for the total-record count.
 *
 * @param {string} administrationId - The administration UUID.
 * @param {{ page?: number, perPage?: number }} [pagination] - The 1-indexed page and page size.
 * @returns {Promise<{ items: Array, pagination: object }>} The page's tree-table nodes plus the pagination envelope.
 */
export async function fetchAdministrationTreeRootPage(
  administrationId,
  { page = 1, perPage = DEFAULT_ROOT_PER_PAGE } = {},
) {
  const client = getRoarApiClient();

  const result = await client.administrations.getTree({
    params: { id: administrationId },
    query: { page, perPage, embed: 'stats' },
  });

  if (result.status !== StatusCodes.OK) {
    const error = new Error(`Failed to fetch administration tree with status ${result.status}`);
    error.status = result.status;
    error.body = result.body;
    throw error;
  }

  return {
    items: result.body.data.items.map(toTreeTableNode),
    pagination: result.body.data.pagination,
  };
}

/**
 * Administration org-tree query (root level, server-paginated).
 *
 * Loads a single page of the root entities (districts and groups) of an
 * administration's org tree from `GET /administrations/:id/tree`. The root level
 * is paginated server-side — PvTreeTable's native paginator drives `page`/`perPage`
 * — so the query fetches exactly one page and resolves to `{ items, pagination }`.
 * Child levels are fetched lazily and in full on node expansion via
 * `fetchAdministrationTreeLevel` (nested levels are NOT paginated).
 *
 * **Reactivity.** `page` and `perPage` are accepted as refs/getters and included in
 * the query key by reference (not `.value`), so the query re-keys and refetches when
 * the user pages the root. Switching the root page replaces the root node set, so
 * any open expansions naturally reset on page change.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} administrationId - The administration UUID.
 * @param {import('vue').MaybeRefOrGetter<number>} page - Current 1-indexed root page.
 * @param {import('vue').MaybeRefOrGetter<number>} perPage - Root page size.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} TanStack query resolving to `{ items, pagination }`.
 */
const useAdministrationTreeQuery = (administrationId, page, perPage, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(administrationId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    // page/perPage are part of the cache key so each root page is cached separately
    // and the query refetches when the user pages. Pass them by reference (not `.value`)
    // so the key stays reactive.
    queryKey: [ADMINISTRATION_TREE_QUERY_KEY, administrationId, page, perPage],
    queryFn: () =>
      fetchAdministrationTreeRootPage(toValue(administrationId), { page: toValue(page), perPage: toValue(perPage) }),
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
