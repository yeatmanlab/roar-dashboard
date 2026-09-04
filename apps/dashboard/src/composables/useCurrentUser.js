import { computed } from 'vue';
import useMeQuery from '@/composables/queries/useMeQuery';

/**
 * Authenticated user state, derived from the `/me` query.
 *
 * Single read-path for the authenticated user across the dashboard. Consumers
 * destructure whichever refs they need (`currentUserId`, `hasUnsignedTos`,
 * `unsignedAgreements`, `data`, `status`) instead of going through the auth
 * store, which no longer holds `/me` data. Reads stay reactive — every
 * returned ref is computed from the live `useMeQuery` cache.
 *
 * Internally this just wraps `useMeQuery()` — the query is internally gated
 * on `authStore.accessToken`, so the same call here is safe before sign-in
 * (`data.value` is undefined, the derived refs default sensibly).
 *
 * Authorization-related derived refs (e.g. `isAdmin`) are intentionally not
 * here — they live in `useUserType` / `usePermissions` and read from
 * `userClaims` until the legacy claims fetch is retired in a later migration.
 *
 * @example
 * const { currentUserId, hasUnsignedTos, isPending } = useCurrentUser();
 *
 * @returns {{
 *   data: import('vue').Ref<unknown>,
 *   status: import('vue').Ref<'pending' | 'error' | 'success'>,
 *   isPending: import('vue').Ref<boolean>,
 *   isFetching: import('vue').Ref<boolean>,
 *   isError: import('vue').Ref<boolean>,
 *   isSuccess: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<Error | null>,
 *   currentUserId: import('vue').ComputedRef<string | undefined>,
 *   hasUnsignedTos: import('vue').ComputedRef<boolean>,
 *   unsignedAgreements: import('vue').ComputedRef<unknown[]>,
 * }}
 */
export default function useCurrentUser() {
  const { data, status, isPending, isFetching, isError, isSuccess, error } = useMeQuery();

  const currentUserId = computed(() => data.value?.id);
  const hasUnsignedTos = computed(() => (data.value?.unsignedAgreements?.length ?? 0) > 0);
  const unsignedAgreements = computed(() => data.value?.unsignedAgreements ?? []);

  return {
    data,
    status,
    isPending,
    isFetching,
    isError,
    isSuccess,
    error,
    currentUserId,
    hasUnsignedTos,
    unsignedAgreements,
  };
}
