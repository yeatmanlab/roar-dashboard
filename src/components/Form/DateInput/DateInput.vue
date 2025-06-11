<template>
  <div class="field col-12 md:col-6">
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
    required: true,
    default: 'date-input',
  },
  hasError: {
    type: Boolean,
    required: false,
    default: false,
  },
  errorMessage: {
    type: String,
    required: false,
    default: 'Please select a valid date',
  },
  minDate: {
    type: Date,
    required: false,
    default: null,
  },
  maxDate: {
    type: Date,
    required: false,
    default: null,
  },
  manualInput: {
    type: Boolean,
    required: false,
    default: false,
  },
});
</script>
