<template>
  <div class="flex flex-wrap" :data-testid="testId">
    <label :for="id" class="block mb-1" :class="{ 'sr-only': labelHidden }" data-testid="dropdown__label">
      <small class="text-gray-500 font-bold">{{ label }}</small>
      <span v-if="required" class="ml-1 text-gray-500">*</span>
    </label>

    <PvSelect
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
  </div>

  <span v-if="hasErrors" class="absolute" data-testid="dropdown__error">
    <span v-for="(error, index) of errors" :key="index">
      <small class="text-xs text-red-500" data-testid="dropdown__error-item">{{ error.$message }}</small>
    </span>
  </span>
</template>

<script setup>
import { nanoid } from 'nanoid';
import { computed } from 'vue';
import PvSelect from 'primevue/select';

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
  testId: {
    type: String,
    default: 'dropdown',
  },
});

const hasErrors = computed(() => props.errors?.length > 0);
</script>
