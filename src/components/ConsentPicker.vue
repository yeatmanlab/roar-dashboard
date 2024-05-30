<template>
  <PvPanel class="m-0 p-0 w-full" header="Select params for the Consent and Assent forms">
    <div class="card flex justify-content-center">
      <div class="flex flex-wrap gap-3">
        <div class="flex align-items-center">
          <PvRadioButton v-model="decision" inputId="helpChoose" name="help" value="help" @change="whatDecision" />
          <label for="helpChoose" class="ml-2">Help me choose</label>
        </div>
        <div class="flex align-items-center">
          <PvRadioButton v-model="decision" inputId="iKnow" name="know" value="know" @change="whatDecision" />
          <label for="iKnow" class="ml-2">I know what to select</label>
        </div>
      </div>
    </div>
    <div class="flex flex-row">
      <div class="align-content-center" style="width: 50%" v-if="helpMeSelect">
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
                @change="checkBoxStatus"
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
              <PvCheckbox v-model="specialParam" input-id="video-recording" value="hasVideo" @change="checkBoxStatus" />
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
              <PvCheckbox v-model="specialParam" input-id="audio-recording" value="hasAudio" @change="checkBoxStatus" />
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
                v-model="specialParam"
                input-id="eye-tracking"
                value="hasEyeTracking"
                @change="checkBoxStatus"
              />
              <label class="ml-2 mr-3 flex cursor-pointer" style="width: 80%" for="eye-tracking">Eye Tracking</label>
              <i class="pi pi-eye" style="font-size: 1rem; width: 20%"></i>
            </div>
          </div>
        </div>
        <div class="hidden">
          <h3 class="mb-4 mt-4">Consent Amount and Expected Time</h3>
          <div class="flex flex-row">
            <div class="mr-1">
              <span class="p-float-label">
                <PvInputText id="consent-amount" v-model="amount" class="w-full" disabled="true" />
                <label for="consent-amount" class="text-sm w-full">Payment Amount $$</label>
              </span>
            </div>
            <div class="ml-3">
              <span class="p-float-label">
                <PvInputText id="consent-time" v-model="expectedTime" class="w-full" disabled="true" />
                <label for="consent-time" class="text-sm w-full">Expected Time Amount</label>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="knowWhatIWant" class="flex flex-column pl-3" style="width: 50%">
        <h3>Select a Consent Form</h3>
        <PvDropdown
          v-model="selectedConsent"
          :options="listOfDocs.consent"
          optionLabel="fileName"
          style="width: 70%"
          @change="updateConsent"
        />
        <h3 class="pt-3">Select an Assent Form</h3>
        <PvDropdown
          v-model="selectedAssent"
          :options="listOfDocs.assent"
          optionLabel="fileName"
          style="width: 70%"
          @change="updateAssent"
        />
        <div div class="hidden">
          <h3 class="mb-4 mt-5">Consent Amount and Expected Time</h3>
          <div class="flex flex-row">
            <div class="mr-1">
              <span class="p-float-label">
                <PvInputText id="consent-amount" v-model="amount" class="w-full" disabled="true" />
                <label for="consent-amount" class="text-sm w-full">Payment Amount $$</label>
              </span>
            </div>
            <div class="ml-3">
              <span class="p-float-label">
                <PvInputText id="consent-time" v-model="expectedTime" class="w-full" disabled="true" />
                <label for="consent-time" class="text-sm w-full">Expected Time Amount</label>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="knowWhatIWant || helpMeSelect" class="flex-column" style="width: 50%">
        <h3 class="font-bold text-center text-xl">Suggested Forms</h3>
        <div class="w-full">
          <PvFieldset legend="Consent" v-if="consents && consents.length > 0">
            <div class="flex flex-row w-full">
              <div style="width: 80%">
                <p class="m-0">
                  <span class="font-bold">Name: </span>{{ result.consent[0]?.fileName }} <br />
                  <span class="font-bold">Current Commit: </span>{{ result.consent[0]?.currentCommit }}
                  <br />
                  <span class="font-bold">GitHub Org: </span>{{ result.consent[0]?.gitHubOrg }} <br />
                  <span class="font-bold">GitHub Repository: </span>{{ result.consent[0]?.gitHubRepository }}
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
                  <span class="font-bold">Name: </span>{{ result.assent[0]?.fileName }} <br />
                  <span class="font-bold">Current Commit: </span>{{ result.assent[0]?.currentCommit }}
                  <br />
                  <span class="font-bold">GitHub Org: </span>{{ result.assent?.gitHubOrg }} <br />
                  <span class="font-bold">GitHub Repository: </span>{{ result.assent[0]?.gitHubRepository }}
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
import { ref, onMounted, watch, computed } from 'vue';
import { fetchLegalDocs } from '@/helpers/query/legal';
import { useQuery } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { marked } from 'marked';
import _lowerCase from 'lodash/lowerCase';
import _mapValues from 'lodash/mapValues';
import _forEach from 'lodash/forEach';

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

const initialized = ref(false);
const showConsent = ref(false);
const consentVersion = ref('');
const confirmText = ref('');
const paramCheckboxData = ref(false);
const specialParam = ref(false);
const amount = ref('');
const expectedTime = ref('');
const helpMeSelect = ref(null);
const selectedConsent = ref(null);
const selectedAssent = ref(null);
const knowWhatIWant = ref(false);
const decision = ref('');

let result = {
  consent: [],
  assent: [],
  amount: amount.value,
  expectedTime: expectedTime.value,
};

function whatDecision() {
  if (decision.value === 'know') {
    knowWhatIWant.value = true;
    helpMeSelect.value = false;
  }
  if (decision.value === 'help') {
    knowWhatIWant.value = false;
    helpMeSelect.value = true;
  }
  specialParam.value = false;
  paramCheckboxData.value = false;
  selectedConsent.value = null;
  selectedAssent.value = null;
  amount.value = '';
  expectedTime.value = '';
  result = {
    consent: [],
    assent: [],
    amount: amount.value,
    expectedTime: expectedTime.value,
  };
}

const authStore = useAuthStore();
const emit = defineEmits(['consent-selected']);

onMounted(() => {
  initialized.value = true;
});

function checkBoxStatus() {
  result = {
    consent: [],
    assent: [],
    amount: amount.value,
    expectedTime: expectedTime.value,
  };
  if (paramCheckboxData.value && paramCheckboxData.value?.find((item) => item === 'hasDefault')) {
    specialParam.value = false;
    getDefaults();
  } else if (
    specialParam.value &&
    specialParam.value?.find((item) => item === 'hasVideo' || item === 'hasAudio' || item === 'hasEyeTracking')
  ) {
    getConsentAssent();
  }
}

const { data: consents } = useQuery({
  queryKey: ['currentCommit', 'currentCommit', 'gitHubOrg', 'lastUpdated'],
  queryFn: fetchLegalDocs,
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000,
});

const listOfDocs = computed(() => {
  let consent = [];
  let assent = [];

  _forEach(consents.value, (doc) => {
    if (doc.type.toLowerCase().includes('consent')) {
      consent.push(doc);
    } else if (!doc.type.toLowerCase().includes('tos')) {
      assent.push(doc);
    }
  });
  return { consent, assent };
});

async function seeConsent(consent) {
  let consentDoc;
  if (consent?.type === 'Assent-es') {
    consentDoc = await authStore.getLegalDoc('assent-es');
  } else {
    consentDoc = await authStore.getLegalDoc((consent?.type).toLowerCase());
  }
  consentVersion.value = consentDoc.version;
  confirmText.value = marked(consentDoc.text);
  showConsent.value = true;
}

function updateConsent() {
  result.consent[0] = selectedConsent.value;
  if (selectedAssent.value && selectedConsent.value) {
    emit('consent-selected', result);
  }
}

function updateAssent() {
  result.assent[0] = selectedAssent.value;
  if (selectedAssent.value && selectedConsent.value) {
    emit('consent-selected', result);
  }
}

function getDefaults() {
  if (consents.value !== undefined) {
    _forEach(consents.value, (consent) => {
      if (consent.type.toLowerCase().includes('consent')) {
        processConsentAssentDefault(consent, result.consent);
      } else if (consent.type.toLowerCase().includes('assent')) {
        processConsentAssentDefault(consent, result.assent);
      }
    });
    emit('consent-selected', result);
    return result;
  }
}

function processConsentAssentDefault(consent, targetArray) {
  if (consent.params) {
    const params = consent.params;
    let hasSpecialParams = false;
    _forEach(params, (param) => {
      const paramName = param;
      if (specialParams.some((param) => param.name === paramName)) {
        hasSpecialParams = true;
        return false;
      }
    });

    if (!hasSpecialParams) {
      _forEach(params, (param) => {
        const paramName = param;
        if (defaultParams.some((param) => param.name === paramName) || paramName === 'default') {
          targetArray.push(consent);
          return false;
        }
      });
    }
  }
}

function getConsentAssent() {
  let foundConsent = false;
  let foundAssent = false;
  if (consents.value !== undefined) {
    _forEach(consents.value, (consent) => {
      if (consent.type.toLowerCase().includes('consent') && !foundConsent) {
        foundConsent = processConsentAssent(consent, result.consent);
      } else if (consent.type.toLowerCase().includes('assent') && !foundAssent) {
        foundAssent = processConsentAssent(consent, result.assent);
      }
    });
    emit('consent-selected', result);
    return result;
  }
}

function processConsentAssent(consent, targetArray) {
  const params = consent.params;

  _forEach(params, (param) => {
    const paramName = param;
    if (
      specialParam.value?.every((item) => item !== 'hasAudio') &&
      specialParam.value?.every((item) => item !== 'hasVideo') &&
      paramName === 'eye-tracking' &&
      params.length === 1
    ) {
      targetArray[0] = consent;
      return true;
    } else if (
      specialParam.value?.every((item) => item !== 'hasEyeTracking') &&
      (paramName === 'video recording' || paramName === 'audio recording')
    ) {
      targetArray[0] = consent;
      return true;
    } else if (params.length === 3) {
      const requiredElements = ['hasVideo', 'hasAudio', 'hasEyeTracking'];
      const matchingElements = specialParam.value?.filter((item) => requiredElements.includes(item)) || [];
      if (matchingElements.length >= 2) {
        targetArray[0] = consent;
        return true;
      }
    }
  });
}

watch(amount, (newValue) => {
  result.amount = newValue;
  emit('consent-selected', result);
});

watch(expectedTime, (newValue) => {
  result.expectedTime = newValue;
  emit('consent-selected', result);
});
</script>
