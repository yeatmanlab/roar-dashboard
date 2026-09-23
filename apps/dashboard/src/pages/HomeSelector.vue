<template>
  <div
    v-if="hasError"
    class="flex flex-column align-items-center justify-content-center min-h-screen-minus-nav"
    data-testid="home-selector__error"
  >
    <AppMessageState
      :type="MESSAGE_STATE_TYPES.ERROR"
      :title="$t('homeSelector.errorTitle')"
      :message="$t('homeSelector.errorMessage')"
    >
      <template #actions>
        <PvButton :label="$t('homeSelector.errorRetry')" @click="handleRetry" />
      </template>
    </AppMessageState>
  </div>

  <div
    v-else-if="isLoading"
    class="flex flex-column align-items-center justify-content-center min-h-screen-minus-nav"
    data-testid="home-selector__loading"
  >
    <AppSpinner style="margin-bottom: 1rem" />
    <span>{{ $t('homeSelector.loading') }}</span>
  </div>

  <div v-else-if="isParticipant"><HomeParticipant /></div>
  <div v-else-if="isLaunchAdmin"><HomeParent /></div>
  <div v-else-if="isAdminUser"><HomeAdministrator /></div>

  <!--
    No branch matched: claims resolved, but they describe a user type this page
    has no home for. Previously this rendered an empty `<div>`, which read as a
    blank screen with no way forward.
  -->
  <div
    v-else
    class="flex flex-column align-items-center justify-content-center min-h-screen-minus-nav"
    data-testid="home-selector__unmatched"
  >
    <AppMessageState
      :type="MESSAGE_STATE_TYPES.EMPTY"
      :title="$t('homeSelector.unmatchedTitle')"
      :message="$t('homeSelector.unmatchedMessage')"
    />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import PvButton from 'primevue/button';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useSentryLogging from '@/composables/useSentryLogging';
import { APP_ROUTES } from '@/constants/routes';
import { AUTH_LOG_MESSAGES } from '@/constants/logMessages';
import AppSpinner from '@/components/AppSpinner.vue';
import { AppMessageState, MESSAGE_STATE_TYPES } from '@/components/AppMessageState';

const HomeParticipant = defineAsyncComponent(() => import('@/pages/HomeParticipant.vue'));
const HomeAdministrator = defineAsyncComponent(() => import('@/pages/HomeAdministrator.vue'));
const HomeParent = defineAsyncComponent(() => import('@/pages/HomeParent.vue'));

const authStore = useAuthStore();
const { ssoProvider } = storeToRefs(authStore);

const router = useRouter();

const { logAuthEvent } = useSentryLogging();

if (ssoProvider.value) {
  router.replace({ path: APP_ROUTES.SSO });
}

const gameStore = useGameStore();
const { requireRefresh } = storeToRefs(gameStore);

const initialized = ref(false);
let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.accessToken) init();
});

const {
  isLoading: isLoadingClaims,
  isFetching: isFetchingClaims,
  data: userClaims,
  error: claimsError,
  refetch: refetchClaims,
} = useUserClaimsQuery({
  enabled: initialized,
});

const { userType, isAdmin, isSuperAdmin, isParticipant, isLaunchAdmin } = useUserType(userClaims);

const isAdminUser = computed(() => isAdmin.value || isSuperAdmin.value || isLaunchAdmin.value);

// The claims query has exhausted its retries, has no data to fall back on,
// and no refetch is in flight. This is the branch that used to be missing:
// `isLoading` below keys off `!userClaims.value`, so without it a failed
// query spun forever. The `isFetchingClaims` gate matters after
// GenericError's Try Again: that path invalidates `/me` before navigating
// here, so the query still holds its old error while the refetch runs —
// without the gate, the user sees this error state flash even when the
// retry succeeds.
const hasError = computed(() => Boolean(claimsError.value) && !userClaims.value && !isFetchingClaims.value);

const isLoading = computed(() => {
  // Identity and role come from `/me`-derived claims — the only signal needed to
  // route to the correct home. The legacy Firestore `userData` gate was removed:
  // it never resolved on the auth-only local stack, and the claims are sufficient
  // on every build (the rendered home component fetches its own data).
  //
  // Stays true on a settled failure, because claims never arrive. That is safe
  // only because the template checks `hasError` first — this branch is never
  // reached in that state. Reorder those branches and the spinner comes back.
  return !initialized.value || isLoadingClaims.value || !userClaims.value;
});

// Mirrors the template's final `v-else`: claims resolved, but no home matches.
const noHomeMatched = computed(
  () => !hasError.value && !isLoading.value && !isParticipant.value && !isLaunchAdmin.value && !isAdminUser.value,
);
watch(
  noHomeMatched,
  (matchedNone) => {
    if (!matchedNone) return;
    // The on-screen copy stays generic on purpose; the diagnostic detail goes
    // here, where Sentry's captureConsoleIntegration picks it up in production.
    console.error('[Auth] no home view matched for the resolved user type', { userType: userType.value });
  },
  { immediate: true },
);

/** Refetch the claims query so the user can recover without a full reload. */
function handleRetry() {
  refetchClaims();
}

// Admin Terms-of-Service consent is no longer gated here. The global router
// guard redirects to SignTos whenever `/me.unsignedAgreements` is non-empty, and
// annual re-consent / version bumps are computed server-side — so the inline
// firekit + Firestore consent modal (getLegalDoc, userData.legal, the August-1
// re-sign heuristic, and useUpdateConsentMutation) has been removed.

watch(userClaims, (updatedUserClaims) => {
  if (updatedUserClaims?.value) {
    const { adminUid, assessmentUid } = updatedUserClaims.value.claims;
    logAuthEvent(AUTH_LOG_MESSAGES.USER_CLAIMS_UPDATED, { data: { assessmentUid, adminUid } });
  }
});
// hide sentry widget if participant
function setSentryWidgetVisibility(show) {
  const sentryWidget = document.getElementById('sentry-feedback');
  if (!sentryWidget) return;
  sentryWidget.style.display = show ? '' : 'none';
}

// run again whenever role changes (like after sign-out/sign-in)
watch(
  isParticipant,
  (participant) => {
    setSentryWidgetVisibility(!participant);
  },
  { immediate: false },
);

onMounted(async () => {
  if (requireRefresh.value) {
    requireRefresh.value = false;
    router.go(0);
  }
  if (authStore.isAuthReady) init();
  setSentryWidgetVisibility(!isParticipant.value);
});
</script>
