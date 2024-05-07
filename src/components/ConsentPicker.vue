<template>
  <PvPanel class="m-0 p-0 w-full" header="Select a Consent/Assent Form"> </PvPanel>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { fetchLegalDocs } from '@/helpers/query/legal';
import { useQuery } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { marked } from 'marked';
import _lowerCase from 'lodash/lowerCase';

let selectedConsentIndex = ref(null);
let isSelected = ref(null);
const initialized = ref(false);
const showConsent = ref(false);
const consentVersion = ref('');
const confirmText = ref('');

const authStore = useAuthStore();
const emit = defineEmits(['consent-selected']);

onMounted(() => {
  initialized.value = true;
});

const { data: consents } = useQuery({
  queryKey: ['currentCommit', 'currentCommit', 'gitHubOrg', 'lastUpdated'],
  queryFn: fetchLegalDocs,
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000,
});

async function seeConsent(consent, index) {
  let consentDoc;
  if (consent.type === 'Assent-es') {
    consentDoc = await authStore.getLegalDoc('assent-es');
  } else {
    consentDoc = await authStore.getLegalDoc(_lowerCase(consent.type));
  }
  consentVersion.value = consentDoc.version;
  confirmText.value = marked(consentDoc.text);
  selectedConsentIndex.value = index;
  showConsent.value = true;
}

watch(isSelected, (newValue, oldValue) => {
  if (newValue !== null && newValue !== oldValue) {
    const selectedConsent = consents.value[newValue];
    if (selectedConsent) {
      emit('consent-selected', selectedConsent);
    }
  }
});
</script>
