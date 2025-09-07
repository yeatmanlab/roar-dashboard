<template>
  <div class="col-12 md:col-6">
    <PvFloatLabel>
      <PvDatePicker
        v-model="model"
        class="w-full"
        show-icon
        :min-date="minDate"
        :max-date="maxDate"
        :manual-input="manualInput"
        icon="pi pi-calendar text-primary p-1"
        input-id="datePicker"
        show-button-bar
        :data-testid="testId"
        :pt="{
          year: { 'data-testId': 'date-picker__year' },
          pcTodayButton: { 'data-testId': 'date-picker__today-button' },
        }"
      />
      <label for="datePicker">{{ label }}</label>
      <small v-if="hasError" class="p-error">{{ errorMessage }}</small>
    </PvFloatLabel>
  </div>
</template>

<script setup>
import PvDatePicker from 'primevue/datepicker';
import PvFloatLabel from 'primevue/floatlabel';

const model = defineModel({ type: Date });

defineProps({
  label: {
    type: String,
    required: true,
  },
  testId: {
    type: String,
    default: 'date-input',
  },
  hasError: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: 'Please select a valid date',
  },
  minDate: {
    type: Date,
    default: null,
  },
  maxDate: {
    type: Date,
    default: null,
  },
  manualInput: {
    type: Boolean,
    default: false,
  },
});
</script>
