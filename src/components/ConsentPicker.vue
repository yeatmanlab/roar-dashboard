<template>
  <PvPanel class="m-0 p-0 w-full" header="Select Consent and Assent Forms">
    <div class="card flex justify-content-center">
      <div v-if="!noConsent" class="flex flex-wrap gap-3">
        <div class="flex align-items-center">
          <PvRadioButton v-model="decision" input-id="helpChoose" name="help" value="help" @change="whatDecision" />
          <label for="helpChoose" class="ml-2">Help me choose</label>
        </div>
        <div class="flex align-items-center">
          <PvRadioButton v-model="decision" input-id="iKnow" name="know" value="know" @change="whatDecision" />
          <label for="iKnow" class="ml-2">I know what to select</label>
        </div>
      </div>
    </div>
    <div class="flex justify-content-center mt-2">
      <PvCheckbox v-model="noConsent" :binary="true" input-id="no-consent" class="flex" value="noConsent" />
      <label class="ml-2 flex text-center" for="no-consent"
        >This administration does not require consent {{ isLevante ? '' : 'or assent' }} forms</label
      >
    </div>
    <div class="flex flex-row">
      <div v-if="userDrivenFlow && !noConsent" class="align-content-center" style="width: 50%">
        <h3>Default Data Collection</h3>
        <div class="border-solid border-round border-1 border-black-alpha-30" style="width: 70%">
          <div style="width: 70%; cursor: pointer">
            <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer" style="width: 100%">
              <div class="flex flex-row w-full cursor-pointer mt-1">
                <PvCheckbox
                  v-model="paramCheckboxData"
                  input-id="default-params"
                  value="hasDefault"
                  @change="checkBoxStatus"
                />
                <i class="pi pi-align-justify" style="font-size: 1rem; width: 8%"></i>
                <label class="mr-3 p-0 ml-1 flex cursor-pointer" style="width: 80%" for="default-params"
                  >Default Data Collection Values</label
                >
              </div>
            </div>
          </div>
          <hr />
          <div class="ml-5" style="width: 70%">
            <div v-for="param in defaultParams" :key="param" class="mt-1 mb-1 ml-3 mr-0 p-0 text-center flex">
              <i :class="param.icon" style="font-size: 1rem; width: 10%"></i>
              <div class="mr-3 ml-0 p-0 flex" style="width: 80%">
                {{ param.name }}
              </div>
            </div>
          </div>
        </div>
        <h3 class="mt-5">Additional Data Collection</h3>
        <div
          v-tooltip.top="tooltip(!disableIfNotDefault ? tooltipMessage : '')"
          :class="[
            'border-solid border-round border-1 border-black-alpha-30 mt-2',
            { 'opacity-80 surface-200 mt-2': !disableIfNotDefault },
          ]"
          style="width: 70%; cursor: pointer"
        >
          <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer">
            <div class="flex flex-row w-full cursor-pointer">
              <PvCheckbox
                v-model="specialParam"
                input-id="video-recording"
                value="hasVideo"
                :class="['cursor-pointer', { 'pointer-events-none': !disableIfNotDefault }]"
                @change="checkBoxStatus"
              />
              <i class="pi pi-video" style="font-size: 1rem; width: 8%"></i>
              <label
                :class="['mr-3 p-0 flex cursor-pointer', { 'pointer-events-none': !disableIfNotDefault }]"
                style="width: 80%"
                for="video-recording"
                >Video Recording</label
              >
            </div>
          </div>
        </div>
        <div
          v-tooltip.top="tooltip(!disableIfNotDefault ? tooltipMessage : '')"
          :class="[
            'border-solid border-round border-1 border-black-alpha-30 mt-2',
            { 'opacity-80 surface-200 mt-2': !disableIfNotDefault },
          ]"
          style="width: 70%; cursor: pointer"
        >
          <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer">
            <div class="flex flex-row w-full cursor-pointer">
              <PvCheckbox
                v-model="specialParam"
                input-id="audio-recording"
                value="hasAudio"
                :class="['cursor-pointer', { 'pointer-events-none': !disableIfNotDefault }]"
                @change="checkBoxStatus"
              />
              <i class="pi pi-phone" style="font-size: 1rem; width: 8%"></i>
              <label
                :class="['mr-3 p-0 flex cursor-pointer', { 'pointer-events-none': !disableIfNotDefault }]"
                style="width: 80%"
                for="audio-recording"
                >Audio Recording</label
              >
            </div>
          </div>
        </div>
        <div
          v-tooltip.top="tooltip(!disableIfNotDefault ? tooltipMessage : '')"
          :class="[
            'border-solid border-round border-1 border-black-alpha-30 mt-2',
            { 'opacity-80 surface-200 mt-2': !disableIfNotDefault },
          ]"
          style="width: 70%; cursor: pointer"
        >
          <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer">
            <div class="flex flex-row w-full cursor-pointer">
              <PvCheckbox
                v-model="specialParam"
                input-id="eye-tracking"
                value="hasEyeTracking"
                :class="['cursor-pointer', { 'pointer-events-none': !disableIfNotDefault }]"
                @change="checkBoxStatus"
              />
              <i class="pi pi-eye" style="font-size: 1rem; width: 8%"></i>
              <label
                :class="['mr-3 p-0 flex cursor-pointer', { 'pointer-events-none': !disableIfNotDefault }]"
                style="width: 80%"
                for="eye-tracking"
                >Eye - Tracking</label
              >
            </div>
          </div>
        </div>
        <div class="hidden">
          <h3 class="mb-4 mt-4">Compensation Amount and Expected Time</h3>
          <div class="flex flex-row">
            <div class="mr-1">
              <PvFloatLabel>
                <PvInputText id="consent-amount" v-model="amount" class="w-full" disabled="true" />
                <label for="consent-amount" class="text-sm w-full">Payment Amount $$</label>
              </PvFloatLabel>
            </div>
            <div class="ml-3">
              <PvFloatLabel>
                <PvInputText id="consent-time" v-model="expectedTime" class="w-full" disabled="true" />
                <label for="consent-time" class="text-sm w-full">Expected Time Amount</label>
              </PvFloatLabel>
            </div>
          </div>
        </div>
      </div>
      <div v-if="knowWhatIWant && !noConsent" class="flex flex-column pl-3" style="width: 50%">
        <h3>Select a Consent Form</h3>
        <PvSelect
          v-model="selectedConsent"
          :options="listOfDocs.consent"
          option-label="fileName"
          style="width: 70%"
          :placeholder="props.legal?.consent[0]?.fileName || 'Select a Consent Form'"
          @change="updateConsent"
        />
        <div v-if="!isLevante">
          <h3 class="pt-3">Select an Assent Form</h3>
          <PvSelect
            v-model="selectedAssent"
            :options="listOfDocs.assent"
            option-label="fileName"
            style="width: 70%"
            :placeholder="props.legal?.assent[0]?.fileName || 'Select an Assent Form'"
            @change="updateAssent"
          />
        </div>
        <div class="hidden">
          <h3 class="mb-4 mt-5">Consent Amount and Expected Time</h3>
          <div class="flex flex-row">
            <div class="mr-1">
              <PvFloatLabel>
                <PvInputText id="consent-amount" v-model="amount" class="w-full" disabled="true" />
                <label for="consent-amount" class="text-sm w-full">Payment Amount $$</label>
              </PvFloatLabel>
            </div>
            <div class="ml-3">
              <PvFloatLabel>
                <PvInputText id="consent-time" v-model="expectedTime" class="w-full" disabled="true" />
                <label for="consent-time" class="text-sm w-full">Expected Time Amount</label>
              </PvFloatLabel>
            </div>
          </div>
        </div>
      </div>
      <div v-if="(knowWhatIWant || userDrivenFlow) && !noConsent" class="flex-column" style="width: 50%">
        <h3 class="font-bold text-center text-xl">Suggested Forms</h3>
        <div class="w-full">
          <PvFieldset v-if="consents && consents.length > 0" legend="Consent">
            <div class="flex flex-row w-full">
              <div style="width: 80%">
                <p class="m-0">
                  <span class="font-bold">Name: </span>{{ result.consent[0]?.fileName }} <br />
                  <span v-if="!isLevante">
                    <span class="font-bold">Current Commit: </span>{{ result.consent[0]?.currentCommit }}
                    <br />
                    <span class="font-bold">GitHub Org: </span>{{ result.consent[0]?.gitHubOrg }} <br />
                    <span class="font-bold">GitHub Repository: </span>{{ result.consent[0]?.gitHubRepository }}
                    <br />
                    <span class="font-bold">Last Updated: </span>{{ result.consent[0]?.lastUpdated }} <br />
                  </span>
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
          <div v-if="!isLevante">
            <PvFieldset v-if="consents && consents.length > 0" legend="Assent">
              <div class="flex flex-row w-full">
                <div style="width: 80%">
                  <p class="m-0">
                    <span class="font-bold">Name: </span>{{ result.assent[0]?.fileName }} <br />
                    <span class="font-bold">Current Commit: </span>{{ result.assent[0]?.currentCommit }}
                    <br />
                    <span class="font-bold">GitHub Org: </span>{{ result.assent[0]?.gitHubOrg }} <br />
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
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-html="confirmText"></div>
  </PvDialog>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { marked } from 'marked';
import _forEach from 'lodash/forEach';
import { isLevante } from '@/helpers';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvCheckbox from 'primevue/checkbox';
import PvDialog from 'primevue/dialog';
import PvSelect from 'primevue/select';
import PvInputText from 'primevue/inputtext';
import PvPanel from 'primevue/panel';
import PvRadioButton from 'primevue/radiobutton';
import PvFieldset from 'primevue/fieldset';
import { useAuthStore } from '@/store/auth';
import useLegalDocsQuery from '@/composables/queries/useLegalDocsQuery';
import { tooltip } from '@/helpers';

interface DefaultParam {
  name: string;
  icon: string;
}

interface SpecialParam {
  name: string;
}

interface LegalDoc {
  fileName: string;
  type: string;
  currentCommit?: string;
  gitHubOrg?: string;
  gitHubRepository?: string;
  lastUpdated?: string;
  params?: string[];
}

interface Legal {
  consent?: LegalDoc[];
  assent?: LegalDoc[];
  amount?: string;
  expectedTime?: string;
}

interface Props {
  legal?: Legal | null;
}

interface Result {
  consent: LegalDoc[];
  assent: LegalDoc[];
  amount: string;
  expectedTime: string;
}

interface Emits {
  'consent-selected': [result: Result | string];
}

const props = withDefaults(defineProps<Props>(), {
  legal: null,
});

const defaultParams: DefaultParam[] = [
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

const specialParams: SpecialParam[] = [
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

const initialized = ref<boolean>(false);
const showConsent = ref<boolean>(false);
const consentVersion = ref<string>('');
const confirmText = ref<string>('');
const paramCheckboxData = ref<string[] | boolean>(false);
const specialParam = ref<string[] | boolean>(false);
const amount = ref<string>('');
const expectedTime = ref<string>('');
const userDrivenFlow = ref<boolean | null>(null);
const noConsent = ref<boolean>(false);
let selectedConsent = ref<LegalDoc | null>(null);
let selectedAssent = ref<LegalDoc | null>(null);
const knowWhatIWant = ref<boolean>(false);
const decision = ref<string>('');
const disableIfNotDefault = ref<boolean>(false);
const tooltipMessage = ref<string>('Please check the "Default Data Collection Values" first');

let result: Result = {
  consent: [],
  assent: [],
  amount: amount.value,
  expectedTime: expectedTime.value,
};

function whatDecision(): void {
  if (decision.value === 'know') {
    knowWhatIWant.value = true;
    userDrivenFlow.value = false;
  }
  if (decision.value === 'help') {
    knowWhatIWant.value = false;
    userDrivenFlow.value = true;
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
const emit = defineEmits<Emits>();

onMounted((): void => {
  initialized.value = true;
  if (!props.legal || Object.keys(props.legal).length === 0) {
    decision.value = 'know';
    knowWhatIWant.value = true;
  } else {
    if (props.legal.consent?.[0]) result.consent[0] = props.legal.consent[0];
    if (props.legal.assent?.[0]) result.assent[0] = props.legal.assent[0];
    result.amount = props.legal.amount || '';
    result.expectedTime = props.legal.expectedTime || '';
    selectedConsent.value = props.legal.consent?.[0] || null;
    selectedAssent.value = props.legal.assent?.[0] || null;
  }
});

watch(
  () => props.legal,
  (newValue) => {
    if (newValue) {
      if (newValue.consent?.[0]) result.consent[0] = newValue.consent[0];
      if (newValue.assent?.[0]) result.assent[0] = newValue.assent[0];
      result.amount = newValue.amount || '';
      result.expectedTime = newValue.expectedTime || '';
      selectedConsent.value = newValue.consent?.[0] || null;
      selectedAssent.value = newValue.assent?.[0] || null;
    }
  },
);

function checkBoxStatus(): void {
  result = {
    consent: [],
    assent: [],
    amount: amount.value,
    expectedTime: expectedTime.value,
  };

  const hasDefault = Array.isArray(paramCheckboxData.value) ? paramCheckboxData.value.includes('hasDefault') : false;

  const hasSpecialParams = Array.isArray(specialParam.value)
    ? specialParam.value.some((item) => ['hasVideo', 'hasAudio', 'hasEyeTracking'].includes(item))
    : false;

  if (hasDefault && (!specialParam.value || !hasSpecialParams)) {
    disableIfNotDefault.value = true;
    getDefaults();
  } else if (hasDefault && hasSpecialParams) {
    getConsentAssent();
  } else {
    disableIfNotDefault.value = false;
    specialParam.value = false;
  }
}

const { data: consents } = useLegalDocsQuery({
  enabled: initialized,
});

const listOfDocs = computed(() => {
  let consent: LegalDoc[] = [];
  let assent: LegalDoc[] = [];

  _forEach(consents.value, (doc: LegalDoc) => {
    if (doc.type.toLowerCase().includes('consent')) {
      consent.push(doc);
    } else if (!doc.type.toLowerCase().includes('tos')) {
      assent.push(doc);
    }
  });
  return { consent, assent };
});

async function seeConsent(consent: LegalDoc): Promise<void> {
  let consentDoc: any;
  if (consent?.type === 'Assent-es') {
    consentDoc = await authStore.getLegalDoc('assent-es');
  } else {
    consentDoc = await authStore.getLegalDoc(consent?.type.toLowerCase());
  }

  consentVersion.value = consentDoc.version;
  confirmText.value = marked(consentDoc.text);
  showConsent.value = true;
}

function updateConsent(): void {
  if (selectedConsent.value) {
    result.consent[0] = selectedConsent.value;
  }
  if (selectedAssent.value && selectedConsent.value) {
    emit('consent-selected', result);
  }
}

function updateAssent(): void {
  if (selectedAssent.value) {
    result.assent[0] = selectedAssent.value;
  }
  if (selectedAssent.value && selectedConsent.value) {
    emit('consent-selected', result);
  }
}

function getDefaults(): Result | undefined {
  if (consents.value !== undefined) {
    _forEach(consents.value, (consent: LegalDoc) => {
      if (consent.type.toLowerCase().includes('consent') && !consent.type.toLowerCase().includes('es')) {
        processConsentAssentDefault(consent, result.consent);
      } else if (consent.type.toLowerCase().includes('assent') && !consent.type.toLowerCase().includes('es')) {
        processConsentAssentDefault(consent, result.assent);
      }
    });
    emit('consent-selected', result);
    return result;
  }
}

function processConsentAssentDefault(consent: LegalDoc, targetArray: LegalDoc[]): void {
  if (consent.params) {
    const params = consent.params;
    let hasSpecialParams = false;
    _forEach(params, (param: string) => {
      const paramName = param;
      if (specialParams.some((param) => param.name === paramName)) {
        hasSpecialParams = true;
        return false;
      }
    });

    if (!hasSpecialParams) {
      _forEach(params, (param: string) => {
        const paramName = param;
        if (defaultParams.some((param) => param.name === paramName) || paramName === 'default') {
          targetArray.push(consent);
          return false;
        }
      });
    }
  }
}

function getConsentAssent(): Result | undefined {
  let foundConsent = false;
  let foundAssent = false;
  if (consents.value !== undefined) {
    _forEach(consents.value, (consent: LegalDoc) => {
      if (
        consent.type.toLowerCase().includes('consent') &&
        !foundConsent &&
        !consent.type.toLowerCase().includes('es')
      ) {
        foundConsent = processConsentAssent(consent, result.consent);
      } else if (
        consent.type.toLowerCase().includes('assent') &&
        !foundAssent &&
        !consent.type.toLowerCase().includes('es')
      ) {
        foundAssent = processConsentAssent(consent, result.assent);
      }
    });
    emit('consent-selected', result);
    return result;
  }
}

function processConsentAssent(consent: LegalDoc, targetArray: LegalDoc[]): boolean {
  const params = consent.params;
  if (!params) return false;

  let found = false;
  _forEach(params, (param: string) => {
    const paramName = param;
    const specialParamArray = Array.isArray(specialParam.value) ? specialParam.value : [];

    if (
      !specialParamArray.includes('hasAudio') &&
      !specialParamArray.includes('hasVideo') &&
      paramName === 'eye-tracking' &&
      params.length === 1
    ) {
      targetArray[0] = consent;
      found = true;
      return false;
    } else if (
      !specialParamArray.includes('hasEyeTracking') &&
      (paramName === 'video recording' || paramName === 'audio recording')
    ) {
      targetArray[0] = consent;
      found = true;
      return false;
    } else if (params.length === 3) {
      const requiredElements = ['hasVideo', 'hasAudio', 'hasEyeTracking'];
      const matchingElements = specialParamArray.filter((item) => requiredElements.includes(item));
      if (matchingElements.length >= 2) {
        targetArray[0] = consent;
        found = true;
        return false;
      }
    }
  });
  return found;
}

// Declare a computed property to watch the legal prop
const computedLegalProps = computed(() => {
  return props.legal ?? {};
});

// Watch the computed property and set the noConsent value accordingly
watch(computedLegalProps, (newValue) => {
  if ((newValue as any).consent === 'No Consent') {
    noConsent.value = true;
  } else {
    noConsent.value = false;
  }
});

watch(amount, (newValue) => {
  result.amount = newValue;
  emit('consent-selected', result);
});

watch(expectedTime, (newValue) => {
  result.expectedTime = newValue;
  emit('consent-selected', result);
});

watch(noConsent, () => {
  if (noConsent.value) {
    emit('consent-selected', 'No Consent');
  } else {
    emit('consent-selected', '');
    noConsent.value = false;
  }
});
</script>

<style scoped>
.p-checkbox-box.p-highlight {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}
.p-radiobutton.p-component.p-radiobutton-checked {
  position: relative;
  width: 20px; /* adjust as needed */
  height: 20px; /* adjust as needed */
  background-color: var(--primary-color);
  border-color: var(--primary-color) !important;
  border-radius: 50%; /* make the element itself circular */
}

.p-radiobutton.p-component.p-radiobutton-checked::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px; /* adjust size of the inner circle as needed */
  height: 5px; /* adjust size of the inner circle as needed */
  background-color: white; /* color of the inner circle */
  border-radius: 50%; /* make the inner element circular */
  transform: translate(-50%, -50%); /* center the inner circle */
}
</style>
