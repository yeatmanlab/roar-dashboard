<template>
  <section class="flex w-full m-4 mt-2 flex-column align-content-center justify-content-center border-500">
    <!-- EMAIL / CHIP -->
    <div class="mt-1 field">
      <div>
        <!-- If we're NOT showing password yet, show the email input -->
        <SignInEmailInput
          v-if="!props.showPasswordField"
          :model-value="props.email"
          :invalid="props.invalid"
          @update:model-value="emit('update:email', $event)"
          @enter="emit('check-providers', $event)"
        />

        <!-- If we ARE already in password flow (or multipleProviders), show chip -->
        <SignedInEmailChip v-else :email="props.email" @remove="emit('clear-email')" />
      </div>
    </div>

    <div v-if="invalid" class="w-full p-2 text-center">
      <PvMessage icon="pi pi-exclamation-circle" class="text-red-500 mb-2" severity="error">
        {{ $t('authSignIn.incorrectEmailOrPassword') }}
      </PvMessage>
    </div>

    <!-- PASSWORD / MAGIC LINK / CREATE PASSWORD -->
    <SignInPasswordBlock
      :show="props.showPasswordField && !props.multipleProviders && !props.emailLinkSent"
      :email-link-sent="props.emailLinkSent"
      :is-username="props.isUsername"
      :invalid="props.invalid"
      :password="props.password"
      @update:password="emit('update:password', $event)"
      @forgot-password="emit('forgot-password')"
      @magic-link="emit('magic-link')"
      @submit="emit('submit')"
    />

    <!-- CONTINUE button (email -> check providers OR password submit) -->
    <PvButton
      v-if="!props.multipleProviders && !props.emailLinkSent"
      type="button"
      class="mt-3 w-full p-0 hover:shadow-4 hover:bg-primary hover:text-white p-2"
      data-cy="signin-continue"
      @click="!props.showPasswordField ? emit('check-providers', props.email) : emit('submit')"
    >
      <span>{{ $t('pageSignIn.continue') }}</span>
    </PvButton>

    <!-- "Use password instead" button after sending magic link -->
    <SignInMagicLinkBackButton v-if="props.emailLinkSent" @back-to-password="emit('back-to-password')" />

    <!-- "Available providers" label when multipleProviders -->
    <div v-if="props.multipleProviders" class="flex justify-content-start w-full">
      <small class="pl-2 pb-2 text-base font-bold text-500">
        {{ $t('pageSignIn.availableProviders') }}
      </small>
    </div>

    <!-- Divider "or" -->
    <div v-if="!props.showPasswordField && !props.multipleProviders" class="divider w-full">
      <span class="text-sm">{{ $t('authSignIn.or') }}</span>
    </div>

    <!-- Provider list buttons -->
    <SignInProvidersList
      v-if="!props.hideProviders"
      :show-generic-providers="props.showGenericProviders"
      :show-scoped-providers="props.showScopedProviders"
      :available-providers="props.availableProviders"
      @auth-clever="emit('auth-clever')"
      @auth-classlink="emit('auth-classlink')"
      @auth-nycps="emit('auth-nycps')"
      @auth-google="emit('auth-google')"
    />
  </section>
</template>

<script setup>
import PvButton from 'primevue/button';
import PvMessage from 'primevue/message';

import SignInEmailInput from '@/containers/SignIn/components/SignInEmailInput.vue';
import SignedInEmailChip from '@/containers/SignIn/components/SignedInEmailChip.vue';
import SignInPasswordBlock from '@/containers/SignIn/components/SignInPasswordBlock.vue';
import SignInMagicLinkBackButton from '@/containers/SignIn/components/SignInMagicLinkBackButton.vue';
import SignInProvidersList from '@/containers/SignIn/components/SignInProvidersList.vue';

const props = defineProps({
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

const emit = defineEmits([
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
