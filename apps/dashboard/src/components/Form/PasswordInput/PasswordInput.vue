<template>
  <div class="roar-form-control" :data-testid="testId">
    <label :for="id" class="roar-form-control__label" :class="{ 'sr-only': labelHidden }">
      {{ label }}
      <span v-if="required" class="roar-form-control__required" aria-hidden="true">*</span>
      <span v-if="required" class="sr-only">(required)</span>
    </label>
    <div class="roar-form-control__password">
      <input
        v-bind="$attrs"
        :id="id"
        v-model="model"
        :type="passwordVisible ? 'text' : 'password'"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :aria-invalid="isInvalid"
        :aria-describedby="descriptionIds"
        class="roar-form-control__input"
        :class="{ 'roar-form-control__input--invalid': isInvalid }"
      />
      <button
        type="button"
        class="roar-form-control__password-toggle"
        :aria-label="passwordVisible ? hidePasswordLabel : showPasswordLabel"
        :aria-pressed="passwordVisible"
        :disabled="disabled"
        @click="passwordVisible = !passwordVisible"
      >
        <i :class="passwordVisible ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
      </button>
    </div>
    <small v-if="help" :id="helpId" class="roar-form-control__help">{{ help }}</small>
    <small v-if="error" :id="errorId" class="roar-form-control__error">{{ error }}</small>
  </div>
</template>

<script setup>
import { computed, ref, useAttrs } from 'vue';
import { nanoid } from 'nanoid';

defineOptions({ name: 'FormPasswordInput', inheritAttrs: false });

const model = defineModel({ type: String, default: '' });
const attrs = useAttrs();
const props = defineProps({
  id: { type: String, default: () => `password-${nanoid()}` },
  label: { type: String, required: true },
  labelHidden: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  error: { type: String, default: '' },
  help: { type: String, default: '' },
  showPasswordLabel: { type: String, default: 'Show password' },
  hidePasswordLabel: { type: String, default: 'Hide password' },
  testId: { type: String, default: 'password-input' },
});

const passwordVisible = ref(false);
const helpId = computed(() => `${props.id}-help`);
const errorId = computed(() => `${props.id}-error`);
const isInvalid = computed(() => props.invalid || Boolean(props.error));
const descriptionIds = computed(
  () =>
    [attrs['aria-describedby'], props.help ? helpId.value : '', props.error ? errorId.value : '']
      .filter(Boolean)
      .join(' ') || undefined,
);
</script>

<style scoped src="../form-controls.scss" lang="scss"></style>
