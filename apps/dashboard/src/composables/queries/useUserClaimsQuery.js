import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { resolveUserClaims } from '@/helpers/resolveUserClaims';
import { USER_CLAIMS_QUERY_KEY } from '@/constants/queryKeys';
/**
 * User claims data query.
 *
 * Resolves claims via `resolveUserClaims`, which reads the legacy Firestore
 * `userClaims` document in deployed builds and derives `super_admin` from the
 * backend `/me` response when the local Auth emulator is enabled (Firestore is
 * not available against the local stack). This keeps the production path
 * unchanged while letting claims-gated queries (e.g. the administrations list)
 * resolve in local dev.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserClaimsQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const { uid } = storeToRefs(authStore);

  const queryConditions = [() => !!uid.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_CLAIMS_QUERY_KEY, uid],
    queryFn: () => resolveUserClaims(uid),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserClaimsQuery;
