<template>
  <Participant v-if="!isAdminRef"/>
  <Administrator v-else-if="isAdminRef" />
  <ConsentModal v-if="showConsent" :consent-text="confirmText" :consent-type="consentType" @accepted="updateConsent"/>
</template>

<script setup>
import { onMounted, ref, toRaw, watch } from "vue";
import { useAuthStore } from '@/store/auth';
import Participant from "./Participant.vue";
import Administrator from "./Administrator.vue";
import _get from "lodash/get"
import { storeToRefs } from "pinia";
import ConsentModal from "../components/ConsentModal.vue";
const authStore = useAuthStore();
const { isFirekitInit, roarfirekit, firekitUserData } = storeToRefs(authStore)
const isAdmin = authStore.isUserAdmin();
const isAdminRef = ref(isAdmin)

const consentType = ref(isAdmin ? 'tos' : 'assent')
const showConsent = ref(false);
const confirmText = ref("");
const consentVersion = ref("");

async function updateConsent() {
  authStore.updateConsentStatus(consentType.value, consentVersion.value)
}

async function checkConsent() {
  // Check for consent
  const consentStatus = _get(roarfirekit.value, `userData.legal.${consentType.value}`) || _get(firekitUserData.value, `legal.${consentType.value}`)
  const consentDoc = await authStore.getLegalDoc(consentType.value);
  consentVersion.value = consentDoc.version
  if(!_get(toRaw(consentStatus), consentDoc.version)){
    confirmText.value = consentDoc.text;
    showConsent.value = true;
  }
}
onMounted(async () => {
  if(isFirekitInit.value){
    await checkConsent();
  }
})
watch(isFirekitInit, async (newValue, oldValue) => {
  await checkConsent();
})
</script>
