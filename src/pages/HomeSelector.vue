<template>
  <div v-if="isLoading">
    <div class="text-center col-full">
      <AppSpinner />
      <p class="text-center">{{ $t('homeSelector.loading') }}</p>
    </div>
  </div>
  <div v-else>
    <HomeParticipant v-if="!isAdmin" />
    <HomeAdministrator v-else-if="isAdmin" />
  </div>
  <ConsentModal
    v-if="showConsent && isAdmin"
    :consent-text="confirmText"
    :consent-type="consentType"
    @accepted="updateConsent"
    @delayed="refreshDocs"
  />
</template>

<script setup>
import { computed, onMounted, ref, toRaw, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import _get from 'lodash/get';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { storeToRefs } from 'pinia';
import { fetchDocById } from '@/helpers/query/utils';
import { useI18n } from 'vue-i18n';

let HomeParticipant, HomeAdministrator, ConsentModal;
const isLevante = import.meta.env.MODE === 'LEVANTE';
const authStore = useAuthStore();
const { roarfirekit, roarUid, uid, userQueryKeyIndex, authFromClever, authFromClassLink } = storeToRefs(authStore);

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

const { isLoading: isLoadingUserData, data: userData } = useQuery({
  queryKey: ['userData', roarUid, userQueryKeyIndex],
  queryFn: () => fetchDocById('users', roarUid.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const { isLoading: isLoadingClaims, data: userClaims } = useQuery({
  queryKey: ['userClaims', uid, userQueryKeyIndex],
  queryFn: () => fetchDocById('userClaims', uid.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const isLoading = computed(() => isLoadingClaims.value || isLoadingUserData.value);

const isAdmin = computed(() => {
  if (userClaims.value?.claims?.super_admin) return true;
  if (_isEmpty(_union(...Object.values(userClaims.value?.claims?.minimalAdminOrgs ?? {})))) return false;
  return true;
});

const consentType = computed(() => {
  if (isAdmin.value) {
    return 'tos';
  } else {
    return i18n.locale.value.includes('es') ? 'assent-es' : 'assent';
  }
});
const showConsent = ref(false);
const confirmText = ref('');
const consentVersion = ref('');

async function updateConsent() {
  if (isAdmin.value) {
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
  if (isAdmin.value) {
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

// Only check consent if the user data is loaded
watch([userClaims, userData], async ([newClaims, newData]) => {
  if (!_isEmpty(newClaims) && !_isEmpty(newData)) {
    await checkConsent();
  }
});

onMounted(async () => {
  HomeParticipant = (await import('@/pages/HomeParticipant.vue')).default;
  HomeAdministrator = (await import('@/pages/HomeAdministrator.vue')).default;
  ConsentModal = (await import('@/components/ConsentModal.vue')).default;

  if (requireRefresh.value) {
    requireRefresh.value = false;
    router.go(0);
  }
  if (roarfirekit.value.restConfig) init();
  if (!isLoading.value) {
    refreshDocs();
  }
});
</script>
