<script setup>
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import AppSpinner from '@/components/AppSpinner.vue';
import ConsentModal from '@/components/ConsentModal.vue';
import { useAuthStore } from '@/store/auth';
import { useTosSigningFlow } from './composables/useTosSigningFlow';
import useAgreementVersionContentQuery from '@/composables/queries/useAgreementVersionContentQuery';
import useRecordUserAgreementMutation from '@/composables/mutations/useRecordUserAgreementMutation';
import { APP_ROUTES, APP_ROUTE_NAMES } from '@/constants/routes';

/**
 * Matches well-formed internal application paths only:
 *   - Begins with `/` followed by at least one safe path character
 *   - Allows alphanumeric, `-`, `_`, `.`, `~`, `/`, `%` (for percent-encoded segments)
 *   - Optional query string: `?` followed by safe query characters
 *   - No protocol, no `//` prefix, no fragment, no whitespace
 * Anything that doesn't match falls back to `APP_ROUTES.HOME`.
 */
const INTERNAL_PATH_REGEX = /^\/[A-Za-z0-9\-_.~/%]+(\?[A-Za-z0-9\-_.~%=&]*)?$/;

const authStore = useAuthStore();
const { currentUserId, hasUnsignedTos } = storeToRefs(authStore);
const route = useRoute();
const router = useRouter();

const { currentAgreement, selectedVersion } = useTosSigningFlow();

// Reactive refs for the version-content query so it re-fetches as the user
// works through the queue. Both IDs are required for the query to run.
const agreementIdRef = computed(() => currentAgreement.value?.agreementId ?? null);
const versionIdRef = computed(() => selectedVersion.value?.versionId ?? null);

const { data: versionContent, isLoading: isLoadingContent } = useAgreementVersionContentQuery(
  agreementIdRef,
  versionIdRef,
);

const recordAgreementMutation = useRecordUserAgreementMutation();

/**
 * Compute the destination to return to after all agreements are signed.
 *
 * The router pushes `?next=<originalPath>` when the TOS guard intercepts a
 * navigation. The candidate must:
 *   - Match the strict internal-path regex (rules out absolute URLs,
 *     protocol-relative `//evil.com`, `javascript:`, whitespace, fragments,
 *     and anything Vue Router doesn't already handle as a known path)
 *   - Not point back at SignTos itself or the sign-in flow (avoids loops)
 * Otherwise fall back to the home route.
 */
const nextDestination = computed(() => {
  const next = typeof route.query.next === 'string' ? route.query.next : null;
  if (
    !next ||
    !INTERNAL_PATH_REGEX.test(next) ||
    next.startsWith(APP_ROUTES.SIGN_TOS) ||
    next.startsWith(APP_ROUTES.SIGN_IN)
  ) {
    return APP_ROUTES.HOME;
  }
  return next;
});

/**
 * Record the user's acceptance of the current agreement version.
 *
 * The mutation's `onSuccess` invalidates the `/me` query, which causes
 * `unsignedAgreements` to refresh; the `hasUnsignedTos` watcher below then
 * navigates to the originally requested route once the queue is empty.
 *
 * Double-click guard: TanStack Query deduplicates concurrent mutations with
 * the same key, but ConsentModal's own `isSubmitting` flag is the primary
 * defense. This early-return is belt-and-suspenders against any future
 * caller wiring that bypasses the modal.
 */
async function handleAccept() {
  if (recordAgreementMutation.isPending.value) {
    return;
  }
  if (!currentUserId.value || !selectedVersion.value) {
    return;
  }
  await recordAgreementMutation.mutateAsync({
    userId: currentUserId.value,
    agreementVersionId: selectedVersion.value.versionId,
  });
}

// Once the unsigned-agreement queue empties, return the user to the originally
// requested route. The watcher fires after the `/me` invalidation from the
// mutation's onSuccess resolves.
watch(
  hasUnsignedTos,
  (hasAny) => {
    if (!hasAny && route.name === APP_ROUTE_NAMES.SIGN_TOS) {
      router.replace(nextDestination.value);
    }
  },
  { immediate: false },
);
</script>

<template>
  <div data-cy="sign-tos__container" class="sign-tos">
    <AppSpinner v-if="isLoadingContent || !currentAgreement || !selectedVersion" />
    <ConsentModal
      v-else-if="versionContent?.content"
      :key="`${currentAgreement.agreementId}:${selectedVersion.versionId}`"
      :consent-text="versionContent.content"
      :consent-type="currentAgreement.agreementName"
      :on-confirm="handleAccept"
    />
  </div>
</template>

<style scoped>
.sign-tos {
  min-height: 60vh;
}
</style>
