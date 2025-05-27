<template>
  <div class="flex flex-column">
    <div>
      <PvSelectButton
        v-model="decision"
        :options="[
          { label: 'Use Date Presets', value: 'presets' },
          { label: 'Let me choose', value: 'custom' },
        ]"
        option-label="label"
        option-value="value"
      />
    </div>
    <div v-if="decision === 'presets'" class="flex flex-row w-full justify-content-between">
      <div v-for="(preset, key) in datePresets" :key="key">
        <div class="flex flex-column align-items-center">
          <PvRadioButton v-model="datePreset" :input-id="key" :value="key" @change="presetChange(key)" />
          <label :for="key">{{ _capitalize(key) }}</label>
          <span class="">
            {{ `${preset.start.toDateString()} - ${preset.end.toDateString()}` }}
          </span>
        </div>
      </div>
    </div>
    <div v-if="decision === 'custom'">
      <DatePicker :min-date="minStartDate" label="Start Date" data-cy="input-start-date" v-model="startDate" />
      <DatePicker :min-date="minEndDate" label="End Date" data-cy="input-end-date" v-model="endDate" />
    </div>
    <!-- {{ startDate }}
    {{ endDate }} -->
  </div>
</template>

<script setup>
import { ref } from 'vue';
import DatePicker from '../RoarDatePicker/DatePicker.vue';
import PvRadioButton from 'primevue/radiobutton';
import PvSelectButton from 'primevue/selectbutton';
import { datePresets } from './presets';
import _capitalize from 'lodash/capitalize';

const startDate = defineModel('start-date', { type: Date });
const endDate = defineModel('end-date', { type: Date });

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
const datePreset = ref(null);

const presetChange = (key) => {
  startDate.value = datePresets[key].start;
  endDate.value = datePresets[key].end;
};
</script>
