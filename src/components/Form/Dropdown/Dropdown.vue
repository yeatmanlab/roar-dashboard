<template>
  <div class="form-section" data-testid="dropdown">
    <label :for="id" class="block mb-1" :class="{ 'sr-only': labelHidden }" data-testid="dropdown__label">
      <small class="text-gray-500 font-bold">{{ label }}</small>
      <span v-if="required" class="ml-1 text-gray-500">*</span>
    </label>

    <PvDropdown
      :id="id"
      v-model="model"
      class="w-full"
      :class="{ 'p-invalid border-red-500': hasErrors }"
      :options="data"
      :option-label="labelKey || null"
      :option-value="valueKey || null"
      :placeholder="loadingData ? 'Loading…' : placeholder"
      :disabled="loadingData || disabled"
      :loading="loadingData"
      :pt="{
        root: {
          'data-testid': 'dropdown__input-wrapper',
        },
        item: {
          'data-testid': 'dropdown__item',
        },
      }"
    />

    <span v-if="hasErrors" class="absolute" data-testid="dropdown__error">
      <span v-for="(error, index) of errors" :key="index">
        <small class="text-xs p-error" data-testid="dropdown__error-item">{{ error.$message }}</small>
      </span>
    </span>
  </div>
</template>

<script setup>
import { nanoid } from 'nanoid';
import { computed } from 'vue';
import PvDropdown from 'primevue/dropdown';

const model = defineModel({ required: true, type: [String, Array, Boolean] });

const props = defineProps({
  id: {
    type: String,
    default: () => `dropdown-${nanoid()}`,
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
    default: false,
  },
  labelKey: {
    type: String,
    default: null,
  },
  valueKey: {
    type: String,
    default: null,
  },
  errors: {
    type: Array,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  required: {
    type: Boolean,
    default: false,
  },
});

const hasErrors = computed(() => props.errors?.length > 0);
</script>
