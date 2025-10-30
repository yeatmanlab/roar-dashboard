<template>
  <PvFloatLabel class="mt-4">
    <PvInputText
      id="email"
      :class="['w-full', 'border-200', { 'p-invalid': props.invalid }]"
      :model-value="props.modelValue"
      aria-describedby="email-error"
      data-cy="sign-in__username"
      @update:model-value="(val) => emit('update:modelValue', val)"
      @keydown="checkForCapsLock"
      @keydown.enter.prevent="emit('enter', props.modelValue)"
    />
    <label for="email" class="text-400">{{ $t('authSignIn.emailPlaceholder') }}</label>
  </PvFloatLabel>

  <PvMessage v-if="props.invalid" icon="pi pi-times-circle" class="text-red-500" severity="error">
    {{ $t('authSignIn.incorrectEmailOrPassword') }}
  </PvMessage>
</template>

<script setup>
import { ref } from 'vue';
import PvFloatLabel from 'primevue/floatlabel';
import PvInputText from 'primevue/inputtext';
import PvMessage from 'primevue/message';

const props = defineProps({
  modelValue: { type: String, default: '' },
  invalid: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'enter']);

const capsLockEnabled = ref(false);

function checkForCapsLock(e) {
  // works on key* events
  if (e?.getModifierState) {
    capsLockEnabled.value = e.getModifierState('CapsLock');
  }
}
</script>
