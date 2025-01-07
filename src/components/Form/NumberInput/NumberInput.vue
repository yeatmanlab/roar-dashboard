<template>
  <div class="flex flex-wrap" :data-testid="testId">
    <label :for="id" class="block mb-1" :class="{ 'sr-only': labelHidden }" data-testid="numberinput__label">
      <small class="text-gray-500 font-bold">{{ label }}</small>
      <span v-if="required" class="ml-1 text-gray-500">*</span>
    </label>

    <PvInputNumber
      :id="id"
      v-model="model"
      class="w-full"
      :class="{ 'p-invalid border-red-500': isInvalid || hasErrors }"
      :placeholder="placeholder"
      :disabled="disabled"
      :pt="{
        root: {
          'data-testid': 'numberinput__input-wrapper',
        },
      }"
    />
  </div>

  <span v-if="hasErrors" class="absolute" data-testid="numberinput__error">
    <span v-for="(error, index) of errors" :key="index">
      <small class="text-xs text-red-500" data-testid="numberinput__error-item">{{ error.$message }}</small>
    </span>
  </span>
</template>

<script setup>
import { nanoid } from 'nanoid';
import PvInputNumber from 'primevue/inputnumber';
import { computed } from 'vue';

const model = defineModel({ required: true, type: Number });

const props = defineProps({
  id: {
    type: String,
    default: () => `input-${nanoid()}`,
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
    default: '',
  },
  isInvalid: {
    type: Boolean,
    default: false,
  },
  errors: {
    type: Array,
    default: () => [],
  },
  required: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  testId: {
    type: String,
    default: 'numberinput',
  },
});

const hasErrors = computed(() => props.errors?.length > 0);
</script>

<style scoped>
/* @TODO: Replace in favour of TailwindCSS class overrides once yeatmanlab/roar-project-management/issues/321 is resolved */
.p-component:disabled {
  background: var(--surface-a);
  border: 1px solid var(--surface-300);
  transition: none;
  appearance: none;
  border-radius: var(--border-radius);
  opacity: 0.6;
  color: var(--text-color);
}
</style>
