import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { ORG_CREATE_MUTATION_KEY } from '@/constants/mutationKeys';
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
 * Dispatch a create POST to the correct backend org endpoint.
 *
 * Each org resource exposes its own `create` method on the ts-rest client and,
 * unlike the update endpoints, posts to the collection root with no path param —
 * the parent reference (districtId / schoolId), when required, lives in the body.
 *
 * @param {ReturnType<typeof getRoarApiClient>} client - The ts-rest API client.
 * @param {string} orgType - The plural org type (`districts` | `schools` | `classes` | `groups`).
 * @param {Object} body - The create body, already shaped for the resource's create schema.
 * @returns {Promise<Object>} The ts-rest response.
 * @throws {Error} If the org type is not creatable via this mutation.
 */
const dispatchCreate = (client, orgType, body) => {
  switch (orgType) {
    case ORG_TYPES.DISTRICTS:
      return client.districts.create({ body });
    case ORG_TYPES.SCHOOLS:
      return client.schools.create({ body });
    case ORG_TYPES.CLASSES:
      return client.classes.create({ body });
    case ORG_TYPES.GROUPS:
      return client.groups.create({ body });
    default:
      throw new Error(`Unsupported org type for create: ${orgType}`);
  }
};

/**
 * Create Org mutation.
 *
 * Creates a district, school, class, or group via the backend org POST
 * endpoints (`POST /districts`, `/schools`, `/classes`, `/groups`, each
 * `201 → { id }`) and invalidates the affected org queries on success so the
 * OrgsList tables and selectors refetch.
 *
 * @returns {Object} The mutation object returned by `useMutation`. The mutation
 *   accepts `{ orgType, body }` where `orgType` is the plural org type and
 *   `body` is already shaped for that resource's create schema.
 */
const useCreateOrgMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [ORG_CREATE_MUTATION_KEY],
    mutationFn: async ({ orgType, body }) => {
      const client = getRoarApiClient();
      const result = await dispatchCreate(client, orgType, body);

      if (result.status !== StatusCodes.CREATED) {
        const error = new Error(`Failed to create ${orgType} with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      return result.body.data;
    },
    onSuccess: () => {
      // Invalidate every org read key so both the OrgsList tables (list keys)
      // and the by-id reads reflect the new org. Org reads are cross-linked
      // (e.g. districts/schools feed both their selector and their tab), so
      // invalidating broadly is simpler and safe than targeting a single org
      // type. Mirrors useUpdateOrgMutation.
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

export default useCreateOrgMutation;
