<template>
  <div v-if="isLoading">
    <div class="text-center col-full">
      <AppSpinner />
      <p class="text-center">{{ $t('homeSelector.loading') }}</p>
    </div>
  </div>

  <div v-else>
    <HomeParticipant v-if="isParticipant" />
    <HomeAdministrator v-else-if="isAdminUser" />
  </div>

  <ConsentModal
    v-if="!isLoading && showConsent && isAdminUser"
    :consent-text="confirmText"
    :consent-type="consentType"
    @accepted="updateConsent"
    @delayed="refreshDocs"
  />
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref, toRaw } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import _get from 'lodash/get';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';

import useUserType from '@/composables/useUserType';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';

const HomeParticipant = defineAsyncComponent(() => import('@/pages/HomeParticipant.vue'));
const HomeAdministrator = defineAsyncComponent(() => import('@/pages/HomeAdministrator.vue'));
const ConsentModal = defineAsyncComponent(() => import('@/components/ConsentModal.vue'));

const isLevante = import.meta.env.MODE === 'LEVANTE';
const authStore = useAuthStore();
const { roarfirekit, userQueryKeyIndex, authFromClever, authFromClassLink } = storeToRefs(authStore);

const router = useRouter();
const i18n = useI18n();

if (authFromClever.value) {
  console.log('Detected Clever authentication, routing to CleverLanding page');
  router.push({ name: 'CleverLanding' });
} else if (authFromClassLink.value) {
  console.log('Detected ClassLink authentication, routing to ClassLinkLanding page');
  router.push({ name: 'ClassLinkLanding' });
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
  if (state.roarfirekit.restConfig) init();
});

const { isLoading: isLoadingUserData, data: userData } = useUserDataQuery({
  enabled: initialized,
});

const { isLoading: isLoadingClaims, data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const { isAdmin, isSuperAdmin, isParticipant } = useUserType(userClaims);

const isAdminUser = computed(() => isAdmin.value || isSuperAdmin.value);
const isLoading = computed(() => isLoadingClaims.value || isLoadingUserData.value);

const consentType = computed(() => {
  if (isAdminUser.value) {
    console.warn('[debug] consentType', 'tos');
    return 'tos';
  } else {
    console.warn('[debug] consentType', i18n.locale.value.includes('es') ? 'assent-es' : 'assent');
    return i18n.locale.value.includes('es') ? 'assent-es' : 'assent';
  }
});
const showConsent = ref(false);
const confirmText = ref('');
const consentVersion = ref('');

async function updateConsent() {
  if (isAdminUser.value) {
    await authStore.updateConsentStatus(consentType.value, consentVersion.value);
    userQueryKeyIndex.value += 1;
  }
}

function refreshDocs() {
  authStore.refreshQueryKeys();
}

async function checkConsent() {
  if (isLevante) {
    // skip the consent for levante
    return;
  }

  // Check for consent
  if (isAdminUser.value) {
    const consentStatus = _get(userData.value, `legal.${consentType.value}`);
    const consentDoc = await authStore.getLegalDoc(consentType.value);
    consentVersion.value = consentDoc.version;

    if (!_get(toRaw(consentStatus), consentDoc.version)) {
      confirmText.value = consentDoc.text;
      showConsent.value = true;
      return;
    }

    const legalDocs = _get(toRaw(consentStatus), consentDoc.version);
    const signedBeforeAugFirst = legalDocs.some((doc) => isSignedBeforeAugustFirst(doc.dateSigned));

    if (signedBeforeAugFirst) {
      confirmText.value = consentDoc.text;
      showConsent.value = true;
    }
  }
}

function isSignedBeforeAugustFirst(signedDate) {
  const currentDate = new Date();
  const augustFirstThisYear = new Date(currentDate.getFullYear(), 7, 1); // August 1st of the current year
  return new Date(signedDate) < augustFirstThisYear;
}

onMounted(async () => {
  if (requireRefresh.value) {
    requireRefresh.value = false;
    router.go(0);
  }
  if (roarfirekit.value.restConfig) init();
  if (!isLoading.value) {
    refreshDocs();
    if (isAdminUser.value) {
      await checkConsent();
    }
  }
});
</script>
