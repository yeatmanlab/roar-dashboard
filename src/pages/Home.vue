<template>
  <div v-if="loading">
    <div class="col-full text-center">
      <AppSpinner />
      <p class="text-center">Loading...</p>
    </div>
  </div>
  <div v-else>
    <Participant v-if="!isAdmin" />
    <Administrator v-else-if="isAdmin" />
  </div>
  <ConsentModal v-if="showConsent" :consent-text="confirmText" :consent-type="consentType" @accepted="updateConsent"
    @delayed="touchFirekit" />
</template>

<script setup>
import { computed, onMounted, ref, toRaw, watch } from "vue";
import { useAuthStore } from '@/store/auth';
import Participant from "./Participant.vue";
import Administrator from "./Administrator.vue";
import _get from "lodash/get"
import { storeToRefs } from "pinia";
import ConsentModal from "../components/ConsentModal.vue";
const authStore = useAuthStore();
const { isFirekitInit, roarfirekit, firekitUserData } = storeToRefs(authStore)

const loading = ref(true);
const isAdmin = ref();

const consentType = computed(() => isAdmin.value ? 'tos' : 'assent');
const showConsent = ref(false);
const confirmText = ref("");
const consentVersion = ref("");

authStore.$subscribe((mutation, state) => {
  if (!["firekitUserData", "firekitAssignmentIds"].includes(mutation.events.key)) {
    authStore.syncFirekitCache(state ?? {});
  }
})

async function updateConsent() {
  authStore.updateConsentStatus(consentType.value, consentVersion.value)
}

async function touchFirekit() {
  roarfirekit.value.newField = 0;
  roarfirekit.value.newField = undefined;
}

async function checkConsent() {
  // Check for consent
  const consentStatus = _get(roarfirekit.value, `userData.legal.${consentType.value}`) || _get(firekitUserData.value, `legal.${consentType.value}`)
  const consentDoc = await authStore.getLegalDoc(consentType.value);
  consentVersion.value = consentDoc.version
  if (!_get(toRaw(consentStatus), consentDoc.version)) {
    confirmText.value = consentDoc.text;
    showConsent.value = true;
  }
}

onMounted(async () => {
  if (isFirekitInit.value) {
    isAdmin.value = authStore.isUserAdmin();
    loading.value = false;
    await checkConsent();
  }
})

watch(isFirekitInit, async (newValue, oldValue) => {
  isAdmin.value = authStore.isUserAdmin();
  loading.value = false;
  await checkConsent();
})
</script>
