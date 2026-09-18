<template>
  <div class="roar-checkbox-control" :data-testid="testId">
    <div class="roar-checkbox-control__row">
      <input
        v-bind="$attrs"
        :id="id"
        v-model="model"
        type="checkbox"
        :required="required"
        :disabled="disabled"
        :aria-invalid="isInvalid"
        :aria-describedby="descriptionIds"
        class="roar-checkbox-control__input"
      />
      <label :for="id" class="roar-checkbox-control__label">
        <slot>{{ label }}</slot>
        <span v-if="required" class="roar-form-control__required" aria-hidden="true">*</span>
        <span v-if="required" class="sr-only">(required)</span>
      </label>
    </div>
    <small v-if="error" :id="errorId" class="roar-checkbox-control__error">{{ error }}</small>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue';
import { nanoid } from 'nanoid';

defineOptions({ name: 'FormCheckboxInput', inheritAttrs: false });

const model = defineModel({ type: Boolean, default: false });
const attrs = useAttrs();
const props = defineProps({
  id: { type: String, default: () => `checkbox-${nanoid()}` },
  label: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  error: { type: String, default: '' },
  testId: { type: String, default: 'checkbox-input' },
});

const errorId = computed(() => `${props.id}-error`);
const isInvalid = computed(() => props.invalid || Boolean(props.error));
const descriptionIds = computed(
  () => [attrs['aria-describedby'], props.error ? errorId.value : ''].filter(Boolean).join(' ') || undefined,
);
</script>

<style scoped src="../form-controls.scss" lang="scss"></style>
