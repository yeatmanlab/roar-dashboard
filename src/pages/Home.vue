<template>
  <div v-if="isLoading">
    <div class="col-full text-center">
      <AppSpinner />
      <p class="text-center">Loading...</p>
    </div>
  </div>
  <div v-else>
    <Participant v-if="!isAdmin" />
    <Administrator v-else-if="isAdmin" />
  </div>
  <ConsentModal
v-if="showConsent" :consent-text="confirmText" :consent-type="consentType" @accepted="updateConsent"
    @delayed="refreshDocs" />
</template>

<script setup>
import { computed, onMounted, ref, toRaw, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useAuthStore } from '@/store/auth';
import Participant from "@/pages/Participant.vue";
import Administrator from "@/pages/Administrator.vue";
import _get from "lodash/get"
import _isEmpty from "lodash/isEmpty";
import _union from "lodash/union";
import { storeToRefs } from "pinia";
import ConsentModal from "@/components/ConsentModal.vue";
import { fetchDocById } from "@/helpers/query/utils";

const authStore = useAuthStore();
const { roarfirekit, userQueryKeyIndex } = storeToRefs(authStore)

const initialized = ref(false);
let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
}

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

const { isLoading: isLoadingUserData, isFetching: isFetchingUserData, data: userData } =
  useQuery({
    queryKey: ['userData', authStore.uid, userQueryKeyIndex],
    queryFn: () => fetchDocById('users', authStore.uid),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

const { isLoading: isLoadingClaims, isFetching: isFetchingClaims, data: userClaims } =
  useQuery({
    queryKey: ['userClaims', authStore.uid, userQueryKeyIndex],
    queryFn: () => fetchDocById('userClaims', authStore.uid),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

const isLoading = computed(() => isLoadingClaims.value || isLoadingUserData.value);
const isFetching = computed(() => isFetchingClaims.value || isFetchingUserData.value);

const isAdmin = computed(() => {
  if (userClaims.value?.claims?.super_admin) return true;
  if (_isEmpty(_union(...Object.values(userClaims.value?.claims?.minimalAdminOrgs ?? {})))) return false;
  return true;
});

const consentType = computed(() => isAdmin.value ? 'tos' : 'assent');
const showConsent = ref(false);
const confirmText = ref("");
const consentVersion = ref("");

// authStore.$subscribe((mutation, state) => {
//   if (!["firekitUserData", "firekitAssignmentIds"].includes(mutation.events?.key)) {
//     // TODO: investigate this
//     authStore.syncFirekitCache(state ?? {});
//   }
// })

async function updateConsent() {
  await authStore.updateConsentStatus(consentType.value, consentVersion.value)
  userQueryKeyIndex.value += 1;
}

function refreshDocs() {
  userQueryKeyIndex.value += 1;
}

async function checkConsent() {
  // Check for consent
  const consentStatus = _get(userData.value, `legal.${consentType.value}`)
  const consentDoc = await authStore.getLegalDoc(consentType.value);
  consentVersion.value = consentDoc.version
  if (!_get(toRaw(consentStatus), consentDoc.version)) {
    confirmText.value = consentDoc.text;
    showConsent.value = true;
  }
}

onMounted(async () => {
  if (roarfirekit.value.restConfig) init();
  if (!isLoading.value) {
    refreshDocs();
    await checkConsent();
  }
})

watch(isLoading, async (newValue) => {
  if (!newValue) {
    await checkConsent();
  }
})
</script>
