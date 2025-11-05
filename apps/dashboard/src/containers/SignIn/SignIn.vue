<template>
  <section class="flex w-full m-0 flex-column align-content-center justify-content-center">
    <!-- EMAIL / CHIP (kept) -->
    <div class="mt-1 field">
      <div>
        <IdentifierInput
          v-if="!showPasswordField && !emailLinkSent"
          :model-value="email"
          :invalid="invalid"
          @update:model-value="$emit('update:email', $event)"
          @enter="$emit('check-providers', $event)"
        />
        <SignInEmailChip v-else :email="email" @remove="$emit('clear-email')" />
      </div>
    </div>

    <!-- ERROR: PvMessage -> Alert -->
    <SignInError
      :show="invalid"
      :title="$t('authSignIn.error')"
      :description="$t('authSignIn.incorrectEmailOrPassword')"
    />

    <!-- PASSWORD -->
    <PasswordInput
      :show="showPasswordField && !multipleProviders && !emailLinkSent"
      :email-link-sent="emailLinkSent"
      :is-username="isUsername"
      :invalid="invalid"
      :password="password"
      @update:password="$emit('update:password', $event)"
      @forgot-password="$emit('forgot-password')"
      @magic-link="$emit('magic-link')"
      @submit="$emit('submit')"
    />

    <!-- CONTINUE button (kept classes) -->
    <PvButton
      v-if="!multipleProviders && !emailLinkSent"
      type="button"
      class="mt-3 w-full p-0 hover:shadow-4 hover:bg-primary hover:text-white p-2"
      data-cy="signin-continue"
      @click="!showPasswordField ? $emit('check-providers', email) : $emit('submit')"
    >
      <span>{{ $t('pageSignIn.continue') }}</span>
    </PvButton>

    <!-- Magic link back / success -->
    <MagicLinkBackButton v-if="emailLinkSent" @back-to-password="$emit('back-to-password')" />

    <!-- label -->
    <div v-if="multipleProviders" class="flex justify-content-start w-full">
      <small class="pl-2 pb-2 text-base font-bold text-500">
        {{ $t('pageSignIn.availableProviders') }}
      </small>
    </div>

    <!-- Divider -->
    <div
      v-if="!showPasswordField && !emailLinkSent && !hideProviders && (showGenericProviders || showScopedProviders)"
      class="divider w-full"
    >
      <span class="text-sm">{{ $t('authSignIn.or') }}</span>
    </div>

    <!-- Providers (now split; same visual using ProviderButton) -->
    <GenericProviders
      v-if="!hideProviders && showGenericProviders && !emailLinkSent && !showPasswordField"
      :available-providers="availableProviders"
      @auth-google="$emit('auth-google')"
    />
    <ScopedProviders
      v-if="!hideProviders && showScopedProviders"
      :available-providers="availableProviders"
      @auth-clever="$emit('auth-clever')"
      @auth-classlink="$emit('auth-classlink')"
      @auth-nycps="$emit('auth-nycps')"
    />
  </section>
</template>

<script setup>
import PvButton from 'primevue/button';

import {
  SignInError,
  IdentifierInput,
  GenericProviders,
  PasswordInput,
  ScopedProviders,
  MagicLinkBackButton,
  SignInEmailChip,
} from './components';

defineProps({
  email: { type: String, default: '' },
  password: { type: String, default: '' },
  invalid: { type: Boolean, default: false },
  showPasswordField: { type: Boolean, default: false },
  multipleProviders: { type: Boolean, default: false },
  emailLinkSent: { type: Boolean, default: false },
  hideProviders: { type: Boolean, default: false },
  isUsername: { type: Boolean, default: false },
  availableProviders: { type: Array, default: () => [] },
  showGenericProviders: { type: Boolean, default: true },
  showScopedProviders: { type: Boolean, default: false },
});
defineEmits([
  'update:email',
  'update:password',
  'check-providers',
  'submit',
  'forgot-password',
  'magic-link',
  'back-to-password',
  'auth-clever',
  'auth-classlink',
  'auth-nycps',
  'auth-google',
  'clear-email',
]);
</script>

<style scoped>
.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: #94a3b8;
  font-weight: 500;
  margin: 1rem 0;
  font-size: 0.95rem;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #d1d5db;
}
.divider::before {
  margin-right: 0.75rem;
}
.divider::after {
  margin-left: 0.75rem;
}
</style>
