<template>
  <div v-if="props.show" class="mt-2 mb-1 field">
    <PvFloatLabel class="mt-4">
      <PvPassword
        id="password"
        :feedback="false"
        :class="['w-full', 'text-200', { 'p-invalid': props.invalid }]"
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
      <small class="text-sm text-400 cursor-pointer font-semibold hover:text-primary" @click="emit('forgot-password')">
        {{ $t('authSignIn.forgotPassword') }}
      </small>

      <!-- Magic Link only if it's an email -->
      <small
        v-if="!props.isUsername"
        class="text-sm text-400 cursor-pointer font-semibold hover:text-primary"
        @click="emit('magic-link')"
      >
        {{ $t('authSignIn.magicLink') || 'Magic Link' }}
      </small>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PvPassword from 'primevue/password';
import PvFloatLabel from 'primevue/floatlabel';

const capsLockEnabled = ref(false);

const props = defineProps({
  show: { type: Boolean, default: false },
  isUsername: { type: Boolean, default: false }, // true if it's a username login
  invalid: { type: Boolean, default: false },
  password: { type: String, default: '' },
});

const emit = defineEmits(['update:password', 'forgot-password', 'magic-link', 'submit']);

function checkForCapsLock(e) {
  if (e?.getModifierState) {
    capsLockEnabled.value = e.getModifierState('CapsLock');
  }
}
</script>
