<template>
  <PvFloatLabel class="mt-4">
    <PvInputText
      id="email"
      :class="['w-full', 'border-200', { 'p-invalid': invalid }]"
      :model-value="modelValue"
      aria-describedby="email-error"
      data-cy="sign-in__username"
      @update:model-value="(v) => $emit('update:modelValue', v)"
      @keydown="checkForCapsLock"
      @keydown.enter.prevent="$emit('enter', modelValue)"
    />
    <label for="email" class="text-400">{{ $t('authSignIn.emailPlaceholder') }}</label>
  </PvFloatLabel>
  <PvMessage v-if="invalid" icon="pi pi-times-circle" class="text-red-500" severity="error">
    {{ $t('authSignIn.incorrectEmailOrPassword') }}
  </PvMessage>
</template>

<script setup>
import PvFloatLabel from 'primevue/floatlabel';
import PvInputText from 'primevue/inputtext';
import PvMessage from 'primevue/message';
import { useCapsLock } from '../../../composables/useCapsLock';

defineProps({ modelValue: { type: String, default: '' }, invalid: { type: Boolean, default: false } });
defineEmits(['update:modelValue', 'enter']);

const { checkForCapsLock } = useCapsLock();
</script>
