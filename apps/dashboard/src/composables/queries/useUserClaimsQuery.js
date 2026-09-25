import { computed, toValue } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import useMeQuery from '@/composables/queries/useMeQuery';
import { deriveClaimsFromMe } from '@/helpers/resolveUserClaims';

/**
 * User claims data query.
 *
 * Delegates to {@link useMeQuery} instead of duplicating the `/me` query
 * config: `useMeQuery` owns the query key, `queryFn`, the access-token gate
 * (AND-ed with any caller `enabled` via `computeQueryOverrides`), and the
 * shared retry policy (pinned after its options spread so callers can't
 * override it). This composable only adds two things:
 *
 * - a `uid` gate, AND-ed here with the caller's `enabled` and passed down as
 *   a computed `enabled` for `useMeQuery` to AND with its token gate; and
 * - a `select` projection into the legacy `{ claims }` shape via
 *   `deriveClaimsFromMe`. The `select` is placed **after** `...queryOptions`,
 *   so a caller-supplied `select` cannot override the projection.
 *
 * Because claims are a projection of the shared `/me` cache entry rather
 * than a second, independently-aging entry, any invalidation, reset, or
 * refetch of `/me` (e.g. after signing an agreement, or an identity reset)
 * propagates to claims automatically.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result; `data` is `{ claims }`.
 */
const useUserClaimsQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const { uid } = storeToRefs(authStore);

  return useMeQuery({
    ...queryOptions,
    enabled: computed(() => !!uid.value && (toValue(queryOptions?.enabled) ?? true)),
    select: (meData) => ({ claims: deriveClaimsFromMe(meData) }),
  });
};

export default useUserClaimsQuery;
