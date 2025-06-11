<template>
  <div>
    <PvPanel header="Select Administration Dates" class="mb-2 xl:height">
      <div class="flex justify-content-center mb-2">
        <PvSelectButton
          v-model="currentMode"
          :options="[
            { label: 'Help me choose', value: 'presets' },
            { label: 'I know what to select', value: 'custom' },
          ]"
          :allow-empty="false"
          option-label="label"
          option-value="value"
          :pt="{ root: { class: 'w-full' }, pcToggleButton: { root: { class: 'w-full' } } }"
          @change="currentModeChange"
        />
      </div>
      <div v-if="currentMode === DATEPICKER_MODE.PRESETS" class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        <button
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
              <label :for="key" class="text-xl font-bold cursor-pointer">{{ preset.label }}</label>
              <span class="cursor-pointer text-grey-500">{{
                `${getDateString(preset.start)} - ${getDateString(preset.end)}`
              }}</span>
            </div>
          </div>
        </button>
      </div>
      <div v-if="currentMode === DATEPICKER_MODE.CUSTOM" class="grid grid-cols-1 gap-2 md:grid-cols-2 w-full mt-4">
        <DateInput
          v-model="startDate"
          :min-date="minStartDate"
          label="Start Date"
          test-id="administration-date-picker__start-date-input"
          class="w-full px-0 pt-4"
        />
        <DateInput
          v-model="endDate"
          :min-date="minEndDate"
          label="End Date"
          test-id="administration-date-picker__end-date-input"
          class="w-full px-0 pt-4"
        />
      </div>
    </PvPanel>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import DateInput from '../Form/DateInput/DateInput.vue';
import PvSelectButton from 'primevue/selectbutton';
import { datePresets } from './presets';
import PvPanel from 'primevue/panel';

const startDate = defineModel('startDate', { type: Date });
const endDate = defineModel('endDate', { type: Date });

defineProps({
  minStartDate: {
    type: Date,
    required: true,
  },
  minEndDate: {
    type: Date,
    required: true,
  },
});

const DATEPICKER_MODE = {
  PRESETS: 'presets',
  CUSTOM: 'custom',
};

const currentMode = ref(DATEPICKER_MODE.PRESETS);
const selectedPreset = ref(null);

// Handle user changing the input method
// Always clear the selected preset. If the user switches away from custom, clear the current date inputs.
const currentModeChange = () => {
  selectedPreset.value = null;
  if (currentMode.value === DATEPICKER_MODE.PRESETS) {
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
  // If the start and end dates are already populated, set the currentMode to custom
  if (startDate.value && endDate.value) {
    // If the start and end dates are not equal to a preset, set the currentMode to custom
    if (
      !Object.values(datePresets).some((preset) => preset.start === startDate.value && preset.end === endDate.value)
    ) {
      currentMode.value = DATEPICKER_MODE.CUSTOM;
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
  background-color: var(--surface-card);
  text-align: start;
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
.grid {
  display: grid !important;
  margin: 0 !important;
}
.height {
  height: 12.5rem;
}

@media (min-width: 1280px) {
  .xl\:height {
    height: 12.5rem;
  }
}
</style>
