import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { ORG_UPDATE_MUTATION_KEY } from '@/constants/mutationKeys';
import { ORG_TYPES } from '@/constants/orgTypes';
import {
  DISTRICTS_QUERY_KEY,
  DISTRICTS_LIST_QUERY_KEY,
  DISTRICT_SCHOOLS_QUERY_KEY,
  SCHOOLS_QUERY_KEY,
  SCHOOL_CLASSES_QUERY_KEY,
  CLASSES_QUERY_KEY,
  GROUPS_QUERY_KEY,
  GROUPS_LIST_QUERY_KEY,
} from '@/constants/queryKeys';

/**
 * Dispatch a PATCH update to the correct backend org endpoint.
 *
 * Each org resource exposes its own `update` method on the ts-rest client and
 * names its path param differently (districts `id`, schools `schoolId`,
 * classes `classId`, groups `groupId`), so the mapping is explicit here.
 *
 * @param {ReturnType<typeof getRoarApiClient>} client - The ts-rest API client.
 * @param {string} orgType - The plural org type (`districts` | `schools` | `classes` | `groups`).
 * @param {string} orgId - The id of the org to update.
 * @param {Object} body - The PATCH body, already shaped for the resource's update schema.
 * @returns {Promise<Object>} The ts-rest response.
 * @throws {Error} If the org type is not updatable via this mutation.
 */
const dispatchUpdate = (client, orgType, orgId, body) => {
  switch (orgType) {
    case ORG_TYPES.DISTRICTS:
      return client.districts.update({ params: { id: orgId }, body });
    case ORG_TYPES.SCHOOLS:
      return client.schools.update({ params: { schoolId: orgId }, body });
    case ORG_TYPES.CLASSES:
      return client.classes.update({ params: { classId: orgId }, body });
    case ORG_TYPES.GROUPS:
      return client.groups.update({ params: { groupId: orgId }, body });
    default:
      throw new Error(`Unsupported org type for update: ${orgType}`);
  }
};

/**
 * Update Org mutation.
 *
 * Updates a district, school, class, or group via the backend org PATCH
 * endpoints (`PATCH /districts/:id`, `/schools/:schoolId`, `/classes/:classId`,
 * `/groups/:groupId`, each `200 → { id }`) and invalidates the affected org
 * queries on success so the OrgsList table and the edited org both refetch.
 *
 * @returns {Object} The mutation object returned by `useMutation`. The mutation
 *   accepts `{ orgType, orgId, body }` where `orgType` is the plural org type
 *   and `body` is already shaped for that resource's update schema.
 */
const useUpdateOrgMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ORG_UPDATE_MUTATION_KEY,
    mutationFn: async ({ orgType, orgId, body }) => {
      const client = getRoarApiClient();
      const result = await dispatchUpdate(client, orgType, orgId, body);

      if (result.status !== StatusCodes.OK) {
        const error = new Error(`Failed to update ${orgType} with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      return result.body.data;
    },
    onSuccess: () => {
      // Invalidate every org read key so both the OrgsList tables (list keys)
      // and the by-id reads EditOrgsForm uses reflect the write. Org reads are
      // cross-linked (e.g. districts/schools feed both their selector and their
      // tab), so invalidating broadly is simpler and safe than targeting a
      // single org type.
      const keys = [
        DISTRICTS_QUERY_KEY,
        DISTRICTS_LIST_QUERY_KEY,
        DISTRICT_SCHOOLS_QUERY_KEY,
        SCHOOLS_QUERY_KEY,
        SCHOOL_CLASSES_QUERY_KEY,
        CLASSES_QUERY_KEY,
        GROUPS_QUERY_KEY,
        GROUPS_LIST_QUERY_KEY,
      ];
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
};

export default useUpdateOrgMutation;
