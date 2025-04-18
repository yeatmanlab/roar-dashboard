<template>
  <PvPanel class="m-0 p-0 w-full" header="Select Consent and Assent Forms">
    <div class="card flex justify-content-center">
      <div v-if="!noConsent" class="flex flex-wrap gap-3">
        <div class="flex align-items-center">
          <PvRadioButton
            v-model="decision"
            input-id="helpChoose"
            name="help"
            value="help"
            @change="whatDecision"
          />
          <label for="helpChoose" class="ml-2">Help me choose</label>
        </div>
        <div class="flex align-items-center">
          <PvRadioButton
            v-model="decision"
            input-id="iKnow"
            name="know"
            value="know"
            @change="whatDecision"
          />
          <label for="iKnow" class="ml-2">I know what to select</label>
        </div>
      </div>
    </div>
    <div class="flex justify-content-center mt-2">
      <PvCheckbox v-model="noConsent" :binary="true" input-id="no-consent" class="flex" @change="handleNoConsentChange" />
      <label class="ml-2 flex text-center" for="no-consent"
        >This administration does not require consent {{ isLevante ? '' : 'or assent' }} forms</label
      >
    </div>
    <div class="flex flex-row">
      <div v-if="userDrivenFlow && !noConsent" class="align-content-center pr-3" style="width: 50%">
        <h3>Default Data Collection</h3>
        <div class="border-solid border-round border-1 border-black-alpha-30" style="width: 100%">
          <div style="cursor: pointer">
            <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer">
              <div class="flex flex-row w-full cursor-pointer mt-1">
                <PvCheckbox
                  v-model="paramCheckboxData"
                  input-id="default-params"
                  value="hasDefault"
                  @change="checkBoxStatus"
                />
                <i class="pi pi-align-justify ml-2" style="font-size: 1rem; width: 8%"></i>
                <label class="mr-3 p-0 ml-1 flex cursor-pointer" style="width: 80%" for="default-params"
                  >Default Data Collection Values</label
                >
              </div>
            </div>
          </div>
          <hr />
          <div class="ml-5">
            <div v-for="param in defaultParams" :key="param.name" class="mt-1 mb-1 ml-3 mr-0 p-0 text-center flex">
              <i :class="param.icon" style="font-size: 1rem; width: 10%"></i>
              <div class="mr-3 ml-0 p-0 flex" style="width: 80%">{{ param.name }}</div>
            </div>
          </div>
        </div>
        <h3 class="mt-5">Additional Data Collection</h3>
        <div
          v-tooltip.top="!disableIfNotDefault ? tooltip : ''"
          :class="[
            'border-solid border-round border-1 border-black-alpha-30 mt-2',
            { 'opacity-80 surface-200 mt-2': !disableIfNotDefault },
          ]"
          style="width: 100%; cursor: pointer"
        >
          <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer">
            <div class="flex flex-row w-full cursor-pointer">
              <PvCheckbox
                v-model="specialParam"
                input-id="video-recording"
                value="hasVideo"
                :disabled="!disableIfNotDefault"
                :class="['cursor-pointer', { 'cursor-not-allowed': !disableIfNotDefault }]"
                @change="checkBoxStatus"
              />
              <i class="pi pi-video ml-2" style="font-size: 1rem; width: 8%"></i>
              <label
                :class="['mr-3 p-0 flex cursor-pointer', { 'opacity-50': !disableIfNotDefault }]"
                style="width: 80%"
                for="video-recording"
                >Video Recording</label
              >
            </div>
          </div>
        </div>
        <div
          v-tooltip.top="!disableIfNotDefault ? tooltip : ''"
          :class="[
            'border-solid border-round border-1 border-black-alpha-30 mt-2',
            { 'opacity-80 surface-200 mt-2': !disableIfNotDefault },
          ]"
          style="width: 100%; cursor: pointer"
        >
          <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer">
            <div class="flex flex-row w-full cursor-pointer">
              <PvCheckbox
                v-model="specialParam"
                input-id="audio-recording"
                value="hasAudio"
                :disabled="!disableIfNotDefault"
                :class="['cursor-pointer', { 'cursor-not-allowed': !disableIfNotDefault }]"
                @change="checkBoxStatus"
              />
              <i class="pi pi-phone ml-2" style="font-size: 1rem; width: 8%"></i>
              <label
                :class="['mr-3 p-0 flex cursor-pointer', { 'opacity-50': !disableIfNotDefault }]"
                style="width: 80%"
                for="audio-recording"
                >Audio Recording</label
              >
            </div>
          </div>
        </div>
        <div
          v-tooltip.top="!disableIfNotDefault ? tooltip : ''"
          :class="[
            'border-solid border-round border-1 border-black-alpha-30 mt-2',
            { 'opacity-80 surface-200 mt-2': !disableIfNotDefault },
          ]"
          style="width: 100%; cursor: pointer"
        >
          <div class="mt-1 mb-1 ml-2 text-center flex cursor-pointer">
            <div class="flex flex-row w-full cursor-pointer">
              <PvCheckbox
                v-model="specialParam"
                input-id="eye-tracking"
                value="hasEyeTracking"
                :disabled="!disableIfNotDefault"
                :class="['cursor-pointer', { 'cursor-not-allowed': !disableIfNotDefault }]"
                @change="checkBoxStatus"
              />
              <i class="pi pi-eye ml-2" style="font-size: 1rem; width: 8%"></i>
              <label
                :class="['mr-3 p-0 flex cursor-pointer', { 'opacity-50': !disableIfNotDefault }]"
                style="width: 80%"
                for="eye-tracking"
                >Eye - Tracking</label
              >
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
          class="w-full"
          :placeholder="props.legal?.consent?.[0]?.fileName || 'Select a Consent Form'"
          @change="updateConsent"
          :loading="isLoading"
        />
        <div v-if="!isLevante">
          <h3 class="pt-3">Select an Assent Form</h3>
          <PvSelect
            v-model="selectedAssent"
            :options="listOfDocs.assent"
            option-label="fileName"
            class="w-full"
            :placeholder="props.legal?.assent?.[0]?.fileName || 'Select an Assent Form'"
            @change="updateAssent"
            :loading="isLoading"
            />
        </div>
      </div>
      <div v-if="(knowWhatIWant || userDrivenFlow) && !noConsent && !isLoading" class="flex-column pl-3" style="width: 50%">
        <h3 class="font-bold text-center text-xl">Suggested/Selected Forms</h3>
        <div class="w-full mb-3">
          <PvFieldset v-if="result.consent && result.consent.length > 0" legend="Consent">
            <div class="flex flex-row w-full">
              <div style="width: 80%">
                <p class="m-0">
                  <span class="font-bold">Name: </span>{{ result.consent[0]?.fileName }} <br />
                  <template v-if="!isLevante">
                    <span class="font-bold">Current Commit: </span>{{ result.consent[0]?.currentCommit }}<br />
                    <span class="font-bold">GitHub Org: </span>{{ result.consent[0]?.gitHubOrg }}<br />
                    <span class="font-bold">GitHub Repository: </span>{{ result.consent[0]?.gitHubRepository }}<br />
                  </template>
                   <span class="font-bold">Last Updated: </span>{{ formatDate(result.consent[0]?.lastUpdated) }} <br />
                </p>
              </div>
              <div class="flex align-items-center justify-content-center">
                <PvButton
                  class="border-circle w-6rem h-6rem m-2 surface-hover text-primary border-none font-bold flex align-items-center justify-content-center hover:text-100 hover:bg-primary"
                  label="Show Consent"
                  @click="seeConsent(result.consent[0])"
                  :disabled="!result.consent[0]"
                />
              </div>
            </div>
          </PvFieldset>
          <div v-else>
            <PvTag severity="warn" class="w-full">No suitable Consent form found based on criteria.</PvTag>
          </div>
        </div>
        <div v-if="!isLevante" class="w-full mt-2">
          <PvFieldset v-if="result.assent && result.assent.length > 0" legend="Assent">
            <div class="flex flex-row w-full">
              <div style="width: 80%">
                <p class="m-0">
                  <span class="font-bold">Name: </span>{{ result.assent[0]?.fileName }} <br />
                  <template v-if="!isLevante">
                    <span class="font-bold">Current Commit: </span>{{ result.assent[0]?.currentCommit }}<br />
                    <span class="font-bold">GitHub Org: </span>{{ result.assent[0]?.gitHubOrg }}<br />
                    <span class="font-bold">GitHub Repository: </span>{{ result.assent[0]?.gitHubRepository }}<br />
                  </template>
                   <span class="font-bold">Last Updated: </span>{{ formatDate(result.assent[0]?.lastUpdated) }} <br />
                </p>
              </div>
              <div class="flex align-items-center justify-content-center">
                <PvButton
                  class="border-circle w-6rem h-6rem m-2 surface-hover text-primary border-none font-bold flex align-items-center justify-content-center hover:text-100 hover:bg-primary"
                  label="Show Assent"
                  @click="seeConsent(result.assent[0])"
                  :disabled="!result.assent[0]"
                />
              </div>
            </div>
          </PvFieldset>
           <div v-else>
            <PvTag severity="warn" class="w-full">No suitable Assent form found based on criteria.</PvTag>
          </div>
        </div>
      </div>
      <div v-if="(knowWhatIWant || userDrivenFlow) && !noConsent && isLoading" class="flex-column align-items-center justify-content-center pl-3" style="width: 50%">
         <PvSkeleton width="100%" height="10rem" class="mb-2"></PvSkeleton>
         <PvSkeleton v-if="!isLevante" width="100%" height="10rem"></PvSkeleton>
      </div>
    </div>
    <ConsentModal
      v-if="currentConsentText"
      :consent-text="currentConsentText"
      :consent-type="currentConsentType || 'Consent'"
      :on-confirm="onDialogConfirm"
    />
  </PvPanel>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import type { Ref, ComputedRef, Reactive } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { UseQueryReturnType } from '@tanstack/vue-query';
import _filter from 'lodash/filter';
import _forEach from 'lodash/forEach';
import _includes from 'lodash/includes';
import _cloneDeep from 'lodash/cloneDeep';
import PvButton from 'primevue/button';
import PvCheckbox from 'primevue/checkbox';
import PvFieldset from 'primevue/fieldset';
import PvFloatLabel from 'primevue/floatlabel';
import PvInputText from 'primevue/inputtext';
import PvPanel from 'primevue/panel';
import PvRadioButton from 'primevue/radiobutton';
import PvSelect from 'primevue/select';
import PvSkeleton from 'primevue/skeleton';
import PvTag from 'primevue/tag';
import ConsentModal from '@/components/ConsentModal.vue';
import useLegalDocsQuery from '@/composables/queries/useLegalDocsQuery';
import { isLevante } from '@/helpers';

interface ConsentDocument {
  id: string;
  fileName: string;
  currentCommit?: string;
  gitHubOrg?: string;
  gitHubRepository?: string;
  lastUpdated?: any;
  project?: 'roar' | 'levante' | 'default';
  text?: string;
  tags?: string[];
  type: 'consent' | 'assent';
}

interface LegalProp {
  consent?: ConsentDocument[];
  assent?: ConsentDocument[];
}

interface Props {
  legal?: LegalProp | null;
}

interface DefaultParam {
  name: string;
  icon: string;
}

interface ListOfDocs {
  consent: ConsentDocument[];
  assent: ConsentDocument[];
}

const props = defineProps<Props>();

const emit = defineEmits<{ (e: 'consents-changed', result: LegalProp | null): void }>();

const decision: Ref<'help' | 'know' | null> = ref(null);
const noConsent: Ref<boolean> = ref(false);
const paramCheckboxData: Ref<string[]> = ref([]);
const specialParam: Ref<string[]> = ref([]);
const userDrivenFlow: Ref<boolean> = ref(false);
const knowWhatIWant: Ref<boolean> = ref(false);
const selectedConsent: Ref<ConsentDocument | null> = ref(null);
const selectedAssent: Ref<ConsentDocument | null> = ref(null);
const listOfDocs: Reactive<ListOfDocs> = reactive({ consent: [], assent: [] });
const result: Reactive<LegalProp> = reactive({ consent: [], assent: [] });
const consents: Ref<ConsentDocument[]> = ref([]);
const currentConsentText: Ref<string | null> = ref(null);
const currentConsentType: Ref<string | null> = ref(null);

const { isLoading, data: legalDocuments }: UseQueryReturnType<ConsentDocument[], Error> = (useLegalDocsQuery as any)();

const defaultParams: DefaultParam[] = [
  { name: 'Task completion and performance data', icon: 'pi pi-chart-line' },
  { name: 'Participant browser & OS Information', icon: 'pi pi-desktop' },
  { name: 'IP Address', icon: 'pi pi-map-marker' },
  { name: 'Participant ID', icon: 'pi pi-user' },
];

const tooltip: string = 'Select \'Default Data Collection Values\' to enable this option.';

const disableIfNotDefault: ComputedRef<boolean> = computed(() =>
  _includes(paramCheckboxData.value, 'hasDefault')
);

const whatDecision = (): void => {
  userDrivenFlow.value = decision.value === 'help';
  knowWhatIWant.value = decision.value === 'know';
  selectedConsent.value = null;
  selectedAssent.value = null;
  paramCheckboxData.value = [];
  specialParam.value = [];
  result.consent = [];
  result.assent = [];
  emitSelection();
};

const checkBoxStatus = (): void => {
  consentByData();
};

const updateConsent = (event: { value: ConsentDocument | null }): void => {
  selectedConsent.value = event.value;
  if (event.value) {
      result.consent = [event.value];
      if (isLevante || !listOfDocs.assent.length) {
          result.assent = [];
          selectedAssent.value = null;
      }
      emitSelection();
  } else {
      result.consent = [];
      emitSelection();
  }
};

const updateAssent = (event: { value: ConsentDocument | null }): void => {
    selectedAssent.value = event.value;
    if (event.value) {
        result.assent = [event.value];
        emitSelection();
    } else {
        result.assent = [];
        emitSelection();
    }
};

const seeConsent = (consentDoc: ConsentDocument | null | undefined): void => {
  if (consentDoc) {
      currentConsentText.value = consentDoc.text || 'No text available.';
      currentConsentType.value = consentDoc.type;
  } else {
      currentConsentText.value = 'Document not available.';
      currentConsentType.value = 'Error';
  }
};

const onDialogConfirm = (): void => {
  currentConsentText.value = null;
  currentConsentType.value = null;
};

const getAllLegalDocs = (docs: ConsentDocument[] | undefined): void => {
  if (!docs) return;
  consents.value = docs;
  listOfDocs.consent = _filter(docs, { type: 'consent' });
  listOfDocs.assent = _filter(docs, { type: 'assent' });

  const initialConsentId = props.legal?.consent?.[0]?.id;
  const initialAssentId = props.legal?.assent?.[0]?.id;

  if (initialConsentId) {
      selectedConsent.value = listOfDocs.consent.find(doc => doc.id === initialConsentId) ?? null;
      if (selectedConsent.value) result.consent = [selectedConsent.value];
  }
  if (initialAssentId) {
      selectedAssent.value = listOfDocs.assent.find(doc => doc.id === initialAssentId) ?? null;
      if (selectedAssent.value) result.assent = [selectedAssent.value];
  }

  if (selectedConsent.value || selectedAssent.value) {
      decision.value = 'know';
      knowWhatIWant.value = true;
      userDrivenFlow.value = false;
  } else if (props.legal === null) {
       noConsent.value = true;
  } else {
      decision.value = null;
      knowWhatIWant.value = false;
      userDrivenFlow.value = false;
  }
};

const consentByData = (): void => {
  const platform = isLevante ? 'levante' : 'roar';
  const requiredTags: string[] = [];

  if (_includes(paramCheckboxData.value, 'hasDefault')) requiredTags.push('default');
  else {
      specialParam.value = [];
      result.consent = [];
      result.assent = [];
      emitSelection();
      return;
  }

  if (_includes(specialParam.value, 'hasVideo')) requiredTags.push('video');
  if (_includes(specialParam.value, 'hasAudio')) requiredTags.push('audio');
  if (_includes(specialParam.value, 'hasEyeTracking')) requiredTags.push('eye-tracking');

  const filterDocs = (docType: 'consent' | 'assent'): ConsentDocument[] => {
      return _filter(listOfDocs[docType], (doc) => {
          const docTags = doc.tags || [];
          const hasAllTags = requiredTags.every(tag => docTags.includes(tag));
          const platformMatch = doc.project === platform || doc.project === 'default' || !doc.project;
          const tagCountMatch = requiredTags.length > 0 ? docTags.length === requiredTags.length : true;
          return platformMatch && hasAllTags && tagCountMatch;
      });
  };

  const filteredConsents = filterDocs('consent');
  let filteredAssents: ConsentDocument[] = [];
  if (!isLevante) {
      filteredAssents = filterDocs('assent');
  }

  result.consent = filteredConsents.length > 0 ? [filteredConsents[0]] : [];
  result.assent = filteredAssents.length > 0 ? [filteredAssents[0]] : [];

  emitSelection();
};

const emitSelection = (): void => {
  if (noConsent.value) {
      emit('consents-changed', null);
      return;
  }

  const hasConsent = result.consent && result.consent.length > 0;
  const hasAssent = result.assent && result.assent.length > 0;

  if (hasConsent && (isLevante || hasAssent)) {
      emit('consents-changed', { consent: result.consent, assent: result.assent });
  } else if (hasConsent && !isLevante && !hasAssent) {
      emit('consents-changed', null);
  } else if (!hasConsent) {
       emit('consents-changed', null);
  } else {
       emit('consents-changed', null);
  }
};

const handleNoConsentChange = (): void => {
    if (noConsent.value) {
        decision.value = null;
        userDrivenFlow.value = false;
        knowWhatIWant.value = false;
        selectedConsent.value = null;
        selectedAssent.value = null;
        paramCheckboxData.value = [];
        specialParam.value = [];
        result.consent = [];
        result.assent = [];
    }
    emitSelection();
};

const formatDate = (date: any): string => {
    if (!date) return 'N/A';
    try {
        const d = date.toDate ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return 'Invalid Date';
        return d.toLocaleDateString();
    } catch (e) {
        return 'Invalid Date';
    }
};

watch(legalDocuments, (newDocs) => {
  if (newDocs) {
      getAllLegalDocs(newDocs);
  }
});

watch(() => props.legal, (newLegal) => {
    getAllLegalDocs(legalDocuments.value);
}, { deep: true });

onMounted(() => {
  if (legalDocuments.value) {
      getAllLegalDocs(legalDocuments.value);
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
  width: 20px;
  height: 20px;
  background-color: var(--primary-color);
  border-color: var(--primary-color) !important;
  border-radius: 50%;
}

.p-radiobutton.p-component.p-radiobutton-checked::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 5px;
  background-color: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
</style>
