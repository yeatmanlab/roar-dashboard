<template>
  <div v-if="show" class="mt-2 mb-1 field">
    <FormPasswordInput
      id="password"
      class="mt-4"
      name="password"
      autocomplete="current-password"
      :label="$t('authSignIn.passwordPlaceholder')"
      :placeholder="$t('authSignIn.passwordPlaceholder')"
      label-hidden
      :model-value="password"
      :invalid="invalid"
      data-cy="sign-in__password"
      @update:model-value="(value) => $emit('update:password', value)"
      @keydown.enter.prevent="$emit('submit')"
    />

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
import FormPasswordInput from '@/components/Form/PasswordInput';

defineProps({
  show: { type: Boolean, default: false },
  isUsername: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  password: { type: String, default: '' },
});

defineEmits(['update:password', 'forgot-password', 'magic-link', 'submit']);
</script>
