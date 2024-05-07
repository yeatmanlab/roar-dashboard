<template>
  <PvPanel class="m-0 p-0 w-full" header="Select a Consent/Assent Form">
    <PvDataView :value="consents" class="w-full ml-3 mr-3 pt-0 pb-0 pr-5">
      <template #list="slotProps">
        <div class="grid">
          <div v-for="(consent, index) in slotProps.items" :key="index" class="w-full">
            <div
              class="flex flex-column sm:flex-row sm:align-items-center p-2 gap-3 hover:surface-200"
              :class="{ 'border-top-1 surface-border': index !== 0 }"
              style="border-radius: 1rem"
            >
              <div
                class="flex flex-column md:flex-row justify-content-between md:align-items-center flex-1 gap-4 boder-round"
              >
                <div class="flex flex-row md:flex-column justify-content-between align-items-start gap-2">
                  <div>
                    <span class="text-lg font-medium text-900 mt-2 text-primary">
                      {{ consent.type }} : <span class="text-color">{{ consent.fileName.stringValue }}</span>
                    </span>
                  </div>
                  <div class="flex flex-row gap-3">
                    <div class="surface-100 p-1" style="border-radius: 30px">
                      <div
                        class="surface-0 flex align-items-center gap-2 justify-content-center py-1 px-2"
                        style="
                          border-radius: 30px;
                          box-shadow:
                            0px 1px 2px 0px rgba(0, 0, 0, 0.04),
                            0px 1px 2px 0px rgba(0, 0, 0, 0.06);
                        "
                      >
                        <span class="text-900 font-medium text-sm">{{ consent.lastUpdated }}</span>
                      </div>
                    </div>
                    <div v-for="param in consent.params">
                      <div v-for="value in param.values">
                        {{ value.stringValue }}
                      </div>
                    </div>
                    <div class="mt-1" style="border-radius: 50%">
                      <PvButton
                        class="p-0 surface-hover w-full border-none border-circle hover:text-100 hover:bg-primary"
                        @click="seeConsent(consent, index)"
                      >
                        <i
                          v-tooltip.top="'View Document'"
                          class="pi pi-info-circle text-primary p-1 border-circle hover:text-100"
                        ></i>
                      </PvButton>
                    </div>
                  </div>
                </div>
                <div class="flex flex-column md:align-items-end gap-5">
                  <div class="flex flex-row-reverse md:flex-row gap-2">
                    <PvRadioButton v-model="isSelected" :input-id="'selectedConsent' + index" :value="index" />
                    <label :for="'selectedConsent' + index">Select</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </PvDataView>
  </PvPanel>
  <PvDialog
    v-if="showConsent && selectedConsentIndex !== null"
    v-model:visible="showConsent"
    :draggable="false"
    modal
    :header="consents[selectedConsentIndex].type"
    :close-on-escape="false"
    :style="{ width: '65vw' }"
    :breakpoints="{ '1199px': '85vw', '575px': '95vw' }"
  >
    <div v-html="confirmText"></div>
  </PvDialog>
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
