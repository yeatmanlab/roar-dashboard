<template>
  <div>
    <PvPanel header="Select Administration Dates" class="my-2">
      <div class="flex justify-content-center mb-2">
        <PvSelectButton
          v-model="decision"
          :options="[
            { label: 'Help me choose', value: 'presets' },
            { label: 'I know what to select', value: 'custom' },
          ]"
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
              <i class="pi pi-check-circle text-green-500" v-if="selectedPreset === key" />
              <i class="pi pi-circle" v-else />
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
        <DatePicker :min-date="minStartDate" label="Start Date" data-cy="input-start-date" v-model="startDate" />
        <DatePicker :min-date="minEndDate" label="End Date" data-cy="input-end-date" v-model="endDate" />
      </div>
    </PvPanel>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import DatePicker from '../RoarDatePicker/DatePicker.vue';
import PvRadioButton from 'primevue/radiobutton';
import PvSelectButton from 'primevue/selectbutton';
import { datePresets } from './presets';
import PvPanel from 'primevue/panel';
import _capitalize from 'lodash/capitalize';

const startDate = defineModel('startDate');
const endDate = defineModel('endDate');

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

// Handles the event of the
const decisionChange = () => {
  if (decision.value === 'custom') {
    selectedPreset.value = null;
  }
  if (decision.value === 'presets') {
    selectedPreset.value = null;
    startDate.value = null;
    endDate.value = null;
  }
};

const presetChange = (key) => {
  selectedPreset.value = key;
  startDate.value = datePresets[key].start;
  endDate.value = datePresets[key].end;
};
const getDateString = (date) => {
  return date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};
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
  margin-left: 0.625rem;
}
</style>
