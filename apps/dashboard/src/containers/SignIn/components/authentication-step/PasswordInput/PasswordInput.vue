<template>
  <div v-if="show" class="mt-2 mb-1 field">
    <PvFloatLabel class="mt-4">
      <PvPassword
        id="password"
        :feedback="false"
        :class="['w-full', 'text-200', { 'p-invalid': invalid }]"
        :input-props="{ autocomplete: 'current-password' }"
        toggle-mask
        show-icon="pi pi-eye-slash"
        hide-icon="pi pi-eye"
        :model-value="password"
        data-cy="sign-in__password"
        @update:model-value="(v) => $emit('update:password', v)"
        @keydown.enter.prevent="$emit('submit')"
      />

      <label for="password">{{ $t('authSignIn.passwordPlaceholder') }}</label>
    </PvFloatLabel>

    <div v-if="!isUsername" class="mt-2 flex w-full align-items-center justify-content-between">
      <small class="text-sm text-400 cursor-pointer font-semibold hover:text-primary" @click="$emit('forgot-password')">
        {{ $t('authSignIn.forgotPassword') }}
      </small>
      <small class="text-sm text-400 cursor-pointer font-semibold hover:text-primary" @click="$emit('magic-link')">
        {{ $t('authSignIn.magicLink') }}
      </small>
    </div>
  </div>
</template>

<script setup>
import PvPassword from 'primevue/password';
import PvFloatLabel from 'primevue/floatlabel';

defineProps({
  show: { type: Boolean, default: false },
  isUsername: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  password: { type: String, default: '' },
});

defineEmits(['update:password', 'forgot-password', 'magic-link', 'submit']);
</script>
