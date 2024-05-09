<template>
  <PvPanel class="m-0 p-0 w-full" header="Select params for the Consent and Assent forms">
    <div class="flex flex-row">
      <div class="align-content-center" style="width: 50%">
        <h3>Default Params</h3>
        <div class="border-solid border-round" style="width: 70%">
          <div v-for="param in defaultParams" :key="param" class="mt-1 mb-1 ml-2 text-center flex">
            <div class="ml-2 mr-3 flex" style="width: 80%">- {{ param.name }}</div>
            <i :class="param.icon" style="font-size: 1rem; width: 20%"></i>
          </div>
        </div>
        <div class="border-solid border-round mt-3" style="width: 70%; cursor: pointer">
          <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer">
            <div class="flex flex-row w-full cursor-pointer">
              <PvCheckbox
                v-model="paramCheckboxData"
                input-id="default-params"
                value="hasDefault"
                @change="getDefaults"
              />
              <label class="ml-2 mr-3 flex cursor-pointer" style="width: 80%" for="default-params"
                >Only Default Parameters</label
              >
              <i class="pi pi-align-justify" style="font-size: 1rem; width: 20%"></i>
            </div>
          </div>
        </div>
        <h3 class="mt-5">Special Params</h3>
        <div class="border-solid border-round" style="width: 70%; cursor: pointer">
          <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer">
            <div class="flex flex-row w-full cursor-pointer">
              <PvCheckbox
                v-model="paramCheckboxData"
                input-id="video-recording"
                value="hasVideo"
                :disabled="isOnlyDefault"
                @change="getConsentAssent"
              />
              <label class="ml-2 mr-3 flex cursor-pointer" style="width: 80%" for="video-recording"
                >Video Recording</label
              >
              <i class="pi pi-video" style="font-size: 1rem; width: 20%"></i>
            </div>
          </div>
        </div>
        <div class="border-solid mt-2 border-round" style="width: 70%; cursor: pointer">
          <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer">
            <div class="flex flex-row w-full cursor-pointer">
              <PvCheckbox
                v-model="paramCheckboxData"
                input-id="audio-recording"
                value="hasAudio"
                :disabled="isOnlyDefault"
                @change="getConsentAssent"
              />
              <label class="ml-2 mr-3 flex cursor-pointer" style="width: 80%" for="audio-recording"
                >Audio Recording</label
              >
              <i class="pi pi-phone" style="font-size: 1rem; width: 20%"></i>
            </div>
          </div>
        </div>
        <div class="border-solid mt-2 border-round" style="width: 70%; cursor: pointer">
          <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer">
            <div class="flex flex-row w-full cursor-pointer">
              <PvCheckbox
                v-model="paramCheckboxData"
                input-id="eye-tracking"
                value="hasEyeTracking"
                :disabled="isOnlyDefault"
                @change="getConsentAssent"
              />
              <label class="ml-2 mr-3 flex cursor-pointer" style="width: 80%" for="eye-tracking">Eye Tracking</label>
              <i class="pi pi-eye" style="font-size: 1rem; width: 20%"></i>
            </div>
          </div>
        </div>
        <div>
          <h3 class="mb-4 mt-4">Consent Amount and Expected Time</h3>
          <div class="flex flex-row">
            <div class="mr-1">
              <span class="p-float-label">
                <PvInputText
                  id="consent-amount"
                  v-model="amount"
                  class="w-full"
                  data-cy="input-administraton-consent-amount"
                />
                <label for="consent-amount" class="text-xs w-full">Payment Amount $$</label>
              </span>
            </div>
            <div class="ml-3">
              <span class="p-float-label">
                <PvInputText
                  id="consent-time"
                  v-model="expectedTime"
                  class="w-full"
                  data-cy="input-administraton-consent-amount"
                />
                <label for="consent-time" class="text-xs w-full">Expected Time Amount</label>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="flex-column" style="width: 50%">
        <h3 class="font-bold text-center text-xl">Suggested Forms</h3>
        <div class="w-full">
          <PvFieldset legend="Consent" v-if="consents && consents.length > 0">
            <div class="flex flex-row w-full">
              <div style="width: 80%">
                <p class="m-0">
                  <span class="font-bold">Name: </span>{{ result.consent[0]?.fileName.stringValue }} <br />
                  <span class="font-bold">Current Commit: </span>{{ result.consent[0]?.currentCommit.stringValue }}
                  <br />
                  <span class="font-bold">GitHub Org: </span>{{ result.consent[0]?.gitHubOrg.stringValue }} <br />
                  <span class="font-bold">GitHub Repository: </span
                  >{{ result.consent[0]?.gitHubRepository.stringValue }}
                  <br />
                  <span class="font-bold">Last Updated: </span>{{ result.consent[0]?.lastUpdated }} <br />
                </p>
              </div>
              <div class="flex align-items-center justify-content-center">
                <PvButton
                  class="border-circle w-6rem h-6rem m-2 surface-hover text-primary border-none font-bold flex align-items-center justify-content-center hover:text-100 hover:bg-primary"
                  label="Show Consent"
                  @click="seeConsent(result.consent[0])"
                />
              </div>
            </div>
          </PvFieldset>
          <div v-else>
            <p>No consent available.</p>
          </div>
        </div>
        <div class="w-full mt-2">
          <PvFieldset legend="Assent" v-if="consents && consents.length > 0">
            <div class="flex flex-row w-full">
              <div style="width: 80%">
                <p class="m-0">
                  <span class="font-bold">Name: </span>{{ result.assent[0]?.fileName.stringValue }} <br />
                  <span class="font-bold">Current Commit: </span>{{ result.assent[0]?.currentCommit.stringValue }}
                  <br />
                  <span class="font-bold">GitHub Org: </span>{{ result.assent[0]?.gitHubOrg.stringValue }} <br />
                  <span class="font-bold">GitHub Repository: </span>{{ result.assent[0]?.gitHubRepository.stringValue }}
                  <br />
                  <span class="font-bold">Last Updated: </span>{{ result.assent[0]?.lastUpdated }} <br />
                </p>
              </div>
              <div class="flex align-items-center justify-content-center">
                <PvButton
                  class="border-circle w-6rem h-6rem m-2 surface-hover text-primary border-none font-bold flex align-items-center justify-content-center hover:text-100 hover:bg-primary"
                  label="Show Assent"
                  @click="seeConsent(result.assent[0])"
                />
              </div>
            </div>
          </PvFieldset>
          <div v-else>
            <p>No assent available.</p>
          </div>
        </div>
      </div>
    </div>
  </PvPanel>
  <PvDialog
    v-if="showConsent"
    v-model:visible="showConsent"
    :draggable="false"
    modal
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

const defaultParams = [
  {
    name: 'Mouse and click',
    icon: 'pi pi-check',
  },
  {
    name: 'Questionnaire responses',
    icon: 'pi pi-list',
  },
  {
    name: 'Scrolling behavior',
    icon: 'pi pi-arrows-v',
  },
  {
    name: 'Button presses',
    icon: 'pi pi-plus-circle',
  },
];

const specialParams = [
  {
    name: 'eye-tracking',
  },
  {
    name: 'video recording',
  },
  {
    name: 'audio recording',
  },
];

let selectedConsentIndex = ref(null);
let isSelected = ref(null);
const initialized = ref(false);
const showConsent = ref(false);
const consentVersion = ref('');
const confirmText = ref('');
const paramCheckboxData = ref();
const index = ref(null);
let result = {
  consent: [],
  assent: [],
};

const authStore = useAuthStore();
const emit = defineEmits(['consent-selected']);
const isOnlyDefault = ref(false);
const amount = ref(null);
const expectedTime = ref(null);

onMounted(() => {
  initialized.value = true;
});

function checkBoxStatus() {
  if (paramCheckboxData.value.includes('hasDefault')) {
    isOnlyDefault.value = true;
  } else {
    isOnlyDefault.value = false;
  }
}

const { data: consents } = useQuery({
  queryKey: ['currentCommit', 'currentCommit', 'gitHubOrg', 'lastUpdated'],
  queryFn: fetchLegalDocs,
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000,
});

async function seeConsent(consent) {
  let consentDoc;
  if (consent?.type === 'Assent-es') {
    consentDoc = await authStore.getLegalDoc('assent-es');
  } else {
    consentDoc = await authStore.getLegalDoc(_lowerCase(consent?.type));
  }
  consentVersion.value = consentDoc.version;
  confirmText.value = marked(consentDoc.text);
  selectedConsentIndex.value = index;
  showConsent.value = true;
}

function getDefaults() {
  result = {
    consent: [],
    assent: [],
  };

  checkBoxStatus();

  if (consents.value !== undefined) {
    for (let i = 0; i < 4; i++) {
      const consent = consents?.value[i];
      if (consent.type.includes('consent') || consent.type.includes('Consent')) {
        processConsentAssentDefault(consent, result.consent);
      } else if (consent.type.includes('assent') || consent.type.includes('Assent')) {
        processConsentAssentDefault(consent, result.assent);
      }
    }
  }
  console.log(result);
  return result;
}

function processConsentAssentDefault(consent, targetArray) {
  if (consent.params) {
    const params = consent.params.arrayValue.values;
    let hasSpecialParams = false; // Flag to track if specialParams exist for this consent/assent
    for (let j = 0; j < params.length; j++) {
      const paramName = params[j].stringValue;
      if (specialParams.some((param) => param.name === paramName)) {
        hasSpecialParams = true;
        break;
      }
    }
    if (!hasSpecialParams) {
      // If there are no specialParams, proceed to check for defaultParams
      for (let j = 0; j < params.length; j++) {
        const paramName = params[j].stringValue;
        if (defaultParams.some((param) => param.name === paramName) || paramName === 'default') {
          targetArray.push(consent);
          break;
        }
      }
    }
  }
}

function getConsentAssent() {
  result = {
    consent: [],
    assent: [],
  };

  checkBoxStatus();

  if (consents) {
    for (let i = 0; i < 4; i++) {
      const consent = consents.value[i];
      if (consent.type.includes('consent') || consent.type.includes('Consent')) {
        processConsentAssent(consent, result.consent);
      } else if (consent.type.includes('assent') || consent.type.includes('Assent')) {
        processConsentAssent(consent, result.assent);
      }
    }
  }
  console.log(result);
  return result;
}

function processConsentAssent(consent, targetArray) {
  if (consent.params) {
    const params = consent.params.arrayValue.values;
    for (let j = 0; j < params.length; j++) {
      const paramName = params[j].stringValue;
      if (specialParams.some((param) => param.name === paramName)) {
        targetArray.push(consent);
        break;
      }
    }
  }
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
