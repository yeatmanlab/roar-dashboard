<template>
  <div v-if="isLoading" class="flex flex-column align-items-center justify-content-center min-h-screen-minus-nav">
    <AppSpinner style="margin-bottom: 1rem" />
    <span>{{ $t('homeSelector.loading') }}</span>
  </div>

  <div v-else>
    <HomeParticipant v-if="isParticipant" />
    <HomeParent v-else-if="isLaunchAdmin" />
    <HomeAdministrator v-else-if="isAdminUser" />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useSentryLogging from '@/composables/useSentryLogging';
import { APP_ROUTES } from '@/constants/routes';
import { AUTH_LOG_MESSAGES } from '@/constants/logMessages';
import { isEmulatorAuthReady } from '@/helpers/isDashboardReady';
import AppSpinner from '@/components/AppSpinner.vue';

const HomeParticipant = defineAsyncComponent(() => import('@/pages/HomeParticipant.vue'));
const HomeAdministrator = defineAsyncComponent(() => import('@/pages/HomeAdministrator.vue'));
const HomeParent = defineAsyncComponent(() => import('@/pages/HomeParent.vue'));

const authStore = useAuthStore();
const { roarfirekit, ssoProvider } = storeToRefs(authStore);

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
  if (state.roarfirekit.restConfig?.() || isEmulatorAuthReady(state)) init();
});

const { isLoading: isLoadingClaims, data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const { isAdmin, isSuperAdmin, isParticipant, isLaunchAdmin } = useUserType(userClaims);

const isAdminUser = computed(() => isAdmin.value || isSuperAdmin.value || isLaunchAdmin.value);

const isLoading = computed(() => {
  // Identity and role come from `/me`-derived claims — the only signal needed to
  // route to the correct home. The legacy Firestore `userData` gate was removed:
  // it never resolved on the auth-only local stack, and the claims are sufficient
  // on every build (the rendered home component fetches its own data).
  return !initialized.value || isLoadingClaims.value || !userClaims.value;
});

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
  if (roarfirekit.value.restConfig?.() || isEmulatorAuthReady(authStore)) init();
  setSentryWidgetVisibility(!isParticipant.value);
});
</script>
