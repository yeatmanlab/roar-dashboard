<template>
  <div v-if="props.show" class="mt-2 mb-1 field">
    <PvFloatLabel class="mt-4" variant="on">
      <PvPassword
        id="password"
        :class="['w-full', { 'p-invalid': props.invalid }]"
        :input-props="{ autocomplete: 'current-password' }"
        toggle-mask
        show-icon="pi pi-eye-slash"
        hide-icon="pi pi-eye"
        :model-value="props.password"
        data-cy="sign-in__password"
        @update:model-value="(val) => emit('update:password', val)"
        @keydown="checkForCapsLock"
        @keydown.enter.prevent="emit('submit')"
      />
      <label for="password">{{ $t('authSignIn.passwordPlaceholder') }}</label>
    </PvFloatLabel>

    <!-- Links row -->
    <div class="mt-2 flex w-full items-center justify-between">
      <!-- Forgot password always visible -->
      <small class="text-link text-sm text-400 sign-in-method-link" @click="emit('forgot-password')">
        {{ $t('authSignIn.forgotPassword') }}
      </small>

      <!-- Magic Link only if it's an email -->
      <small
        v-if="!props.isUsername"
        class="text-link text-sm text-400 sign-in-method-link"
        @click="emit('magic-link')"
      >
        {{ $t('authSignIn.magicLink') || 'Magic Link' }}
      </small>
    </div>

    <div v-if="capsLockEnabled" class="mt-2 p-error">⇪ Caps Lock is on!</div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PvPassword from 'primevue/password';
import PvFloatLabel from 'primevue/floatlabel';

const props = defineProps({
  show: { type: Boolean, default: false },
  isUsername: { type: Boolean, default: false }, // true if it's a username login
  invalid: { type: Boolean, default: false },
  password: { type: String, default: '' },
});

const emit = defineEmits(['update:password', 'forgot-password', 'magic-link', 'submit']);

const capsLockEnabled = ref(false);

function checkForCapsLock(e) {
  if (e?.getModifierState) {
    capsLockEnabled.value = e.getModifierState('CapsLock');
  }
}
</script>

<style scoped>
.text-link {
  cursor: pointer;
  color: var(--text-color-secondary);
  font-weight: bold;
  text-decoration: underline;
  font-size: 1rem;
}
.text-link:hover {
  color: var(--primary-color-text);
}
.sign-in-method-link {
  margin-top: 0.5rem;
  display: flex;
}
</style>
