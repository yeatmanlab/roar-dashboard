<template>
  <div>
    <PvPanel header="Select Administration Dates" class="mb-2">
      <div class="flex justify-content-center mb-2">
        <PvSelectButton
          v-model="decision"
          :options="[
            { label: 'Help me choose', value: 'presets' },
            { label: 'I know what to select', value: 'custom' },
          ]"
          :allow-empty="false"
          option-label="label"
          option-value="value"
          @change="decisionChange"
        />
      </div>
      <div v-if="decision === 'presets'" class="flex flex-row w-full my-2">
        <div
          v-for="(preset, key) in datePresets"
          :key="key"
          class="card"
          :class="{ 'selected-card': selectedPreset === key }"
          @click="presetChange(key)"
        >
          <div class="flex flex-row">
            <span class="card-icon">
              <i v-if="selectedPreset === key" class="pi pi-check-circle" style="color: var(--primary-color)" />
              <i v-else class="pi pi-circle" />
            </span>
            <div class="flex flex-column">
              <label :for="key" class="text-xl font-bold cursor-pointer">{{ _capitalize(key) }}</label>
              <span class="cursor-pointer text-grey-500">{{
                `${getDateString(preset.start)} - ${getDateString(preset.end)}`
              }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="decision === 'custom'" class="flex flex-row w-full justify-content-between mt-4">
        <DatePicker v-model="startDate" :min-date="minStartDate" label="Start Date" data-cy="input-start-date" />
        <DatePicker v-model="endDate" :min-date="minEndDate" label="End Date" data-cy="input-end-date" />
      </div>
    </PvPanel>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import DatePicker from '../Form/DateInput/DateInput.vue';
import PvSelectButton from 'primevue/selectbutton';
import { datePresets } from './presets';
import PvPanel from 'primevue/panel';
import _capitalize from 'lodash/capitalize';

const startDate = defineModel('startDate', { type: Date });
const endDate = defineModel('endDate', { type: Date });

// eslint-disable-next-line no-unused-vars
const props = defineProps({
  minStartDate: {
    type: Date,
    required: true,
  },
  minEndDate: {
    type: Date,
    required: true,
  },
});

const decision = ref('presets');
const selectedPreset = ref(null);

// Handle user changing the input method
// Always clear the selected preset. If the user switches away from custom, clear the current date inputs.
const decisionChange = () => {
  selectedPreset.value = null;
  if (decision.value === 'presets') {
    startDate.value = null;
    endDate.value = null;
  }
};

// Handle user selecting a preset
const presetChange = (key) => {
  selectedPreset.value = key;
  startDate.value = datePresets[key].start;
  endDate.value = datePresets[key].end;
};

// Format a date to a string
const getDateString = (date) => {
  return date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

onMounted(() => {
  // If the start and end dates are already populated, set the decision to custom
  if (startDate.value && endDate.value) {
    // If the start and end dates are not equal to a preset, set the decision to custom
    if (
      !Object.values(datePresets).some((preset) => preset.start === startDate.value && preset.end === endDate.value)
    ) {
      decision.value = 'custom';
    }
  }
});
</script>
<style scoped>
.card {
  border: 2px solid var(--surface-border);
  border-radius: var(--border-radius);
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0.5rem;
  margin: 0.25rem;
  cursor: pointer;
}
.card:hover {
  background-color: var(--surface-hover);
}
.selected-card {
  background-color: var(--surface-hover);
}
.card-icon {
  margin-top: 0.25rem;
  margin-right: 0.625rem;
  margin-left: 0.5rem;
}
</style>
