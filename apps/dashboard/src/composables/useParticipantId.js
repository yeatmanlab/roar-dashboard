import { computed, toValue } from 'vue';
import useCurrentUser from '@/composables/useCurrentUser';

/**
 * The participant's ROAR (Postgres) user id for the current launch.
 *
 * Every per-user backend read on a launch surface is keyed on this id — the
 * student homepage's administrations/agreements/memberships queries and each
 * task component's student-data query and run creation. It resolves the two
 * launch paths into one value:
 *
 * - **Proxy launch** (`launchId` set): a parent launching a child from
 *   `StudentCardSimple`, which pushes `LaunchParticipant` with
 *   `params: { launchId: props.userId }` — the child's user id. It is the
 *   participant identity directly, so it resolves synchronously and no `/me`
 *   read is needed. Run creation targets this participant via
 *   `POST /v1/user/:userId/runs`, which the backend authorizes with
 *   `can_create_run_for_child`.
 * - **Self launch** (`launchId` null/undefined): the launching user's own id,
 *   from `/me` via {@link useCurrentUser}.
 *
 * Resolving this centrally matters because the id is easy to get subtly wrong:
 * `authStore.roarUid` is a **Firestore** UID, and the backend's user endpoints
 * are uuid-typed, so a fallback to it can never succeed. `useUserStudentDataQuery`
 * does exactly that for a falsy argument, which is why consumers gate their
 * per-user queries on this id being truthy rather than passing `launchId`
 * straight through.
 *
 * No enablement argument is needed: `useMeQuery` is internally gated on
 * `authStore.accessToken`, `App.vue` already runs it app-wide, and the router
 * awaits it in a navigation guard — so by the time a launch surface mounts the
 * result is a cache read, and concurrent callers dedupe on `[ME_QUERY_KEY]`.
 *
 * @example
 * const participantId = useParticipantId(props.launchId);
 * const { data: userData } = useUserStudentDataQuery(participantId, {
 *   enabled: computed(() => initialized.value && Boolean(participantId.value)),
 * });
 *
 * @param {import('vue').MaybeRefOrGetter<String|null|undefined>} launchId – The
 *   proxy-launch participant id, when launching on another user's behalf.
 * @returns {import('vue').ComputedRef<String|undefined>} The participant's ROAR
 *   (Postgres) user id, or `undefined` until it resolves on the self path.
 */
export default function useParticipantId(launchId) {
  const { currentUserId } = useCurrentUser();

  return computed(() => toValue(launchId) ?? currentUserId.value);
}
