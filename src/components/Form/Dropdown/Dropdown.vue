<template>
  <div class="form-section">
    <label :for="id" class="block mb-1" :class="{ 'sr-only': labelHidden }">
      <small class="text-gray-500 font-bold">{{ label }}</small>
      <span v-if="required" class="ml-1 text-gray-500">*</span>
    </label>

    <PvDropdown
      v-model="model"
      class="w-full"
      :options="data"
      :option-label="labelKey || null"
      :option-value="valueKey || null"
      :placeholder="loadingData ? 'Loading…' : placeholder"
      :disabled="loadingData || disabled"
    />

    <span v-if="hasErrors" class="absolute">
      <span v-for="(error, index) of errors" :key="index">
        <small class="text-xs p-error">{{ error.$message }}</small>
      </span>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import PvDropdown from 'primevue/dropdown';

const model = defineModel({ required: true, type: String });

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  labelHidden: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    required: true,
  },
  data: {
    type: Array,
    required: true,
  },
  loadingData: {
    type: Boolean,
    required: false,
    default: false,
  },
  labelKey: {
    type: String,
    required: true,
  },
  valueKey: {
    type: String,
    required: true,
  },
  isInvalid: {
    type: Boolean,
    required: true,
  },
  errors: {
    type: Array,
    required: true,
  },
  disabled: {
    type: Boolean,
    required: false,
    default: false,
  },
});

const hasErrors = computed(() => props.errors?.length > 0);
</script>
