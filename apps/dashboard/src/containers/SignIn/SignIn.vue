<!-- apps/dashboard/src/containers/SignIn/SignIn.vue -->
<template>
  <section class="flex w-full m-0 flex-column align-content-center justify-content-center">
    <!-- TITLE + SUBTITLE -->
    <SignInHeader
      :multiple-providers="multipleProviders"
      :email-link-sent="emailLinkSent"
      :show-password-field="showPasswordField"
      class="mb-2"
    />
    <!-- EMAIL / CHIP -->
    <div class="mt-1 field">
      <div>
        <IdentifierInput
          v-if="!showPasswordField && !emailLinkSent && !multipleProviders"
          :model-value="email"
          :invalid="invalid"
          @update:model-value="onEmailUpdate"
          @enter="checkAvailableProviders"
        />
        <SignInEmailChip v-else :email="email" @remove="resetSignInUI" />
      </div>
    </div>

    <!-- ERROR -->
    <SignInError
      :show="invalid"
      :title="$t('authSignIn.error')"
      :description="$t('authSignIn.incorrectEmailOrPassword')"
    />

    <!-- PASSWORD RESET ALERT -->
    <SuccessAlert
      :show="showSuccessAlert"
      :title="$t('authSignIn.success')"
      :description="$t('authSignIn.checkYourEmail', { successEmail })"
    />

    <!-- PASSWORD -->
    <PasswordInput
      :show="showPasswordField && !multipleProviders && !emailLinkSent"
      :email-link-sent="emailLinkSent"
      :is-username="isUsername"
      :invalid="invalid"
      :password="password"
      @update:password="onPasswordUpdate"
      @forgot-password="handleForgotPassword"
      @magic-link="() => sendMagicLink(email)"
      @submit="authWithEmailPassword"
    />

    <!-- CONTINUE -->
    <PvButton
      v-if="!multipleProviders && !emailLinkSent"
      type="button"
      class="mt-3 w-full p-0 hover:shadow-4 hover:bg-primary hover:text-white p-2"
      data-cy="signin-continue"
      @click="!showPasswordField ? checkAvailableProviders(email) : authWithEmailPassword()"
    >
      <span>{{ $t('pageSignIn.continue') }}</span>
    </PvButton>

    <!-- Magic link back / success -->
    <MagicLinkBackButton v-if="emailLinkSent" @back-to-password="handleBackToPassword" />

    <!-- label -->
    <div v-if="multipleProviders" class="flex justify-content-start w-full">
      <small class="pl-2 pb-2 text-base font-bold text-500">
        {{ $t('pageSignIn.availableProviders') }}
      </small>
    </div>

    <!-- Divider (only on first screen, not on chooser) -->
    <div v-if="!showPasswordField && !emailLinkSent && !hideProviders && !multipleProviders" class="divider w-full">
      <span class="text-sm">{{ $t('authSignIn.or') }}</span>
    </div>

    <!-- Providers row -->
    <Providers
      v-if="!hideProviders && (showGenericProviders || showScopedProviders)"
      :available-providers="availableProviders"
      :show-all-district="!hasCheckedProviders"
      @auth-google="authWithGoogle"
      @auth-clever="authWithClever"
      @auth-classlink="authWithClassLink"
      @auth-nycps="authWithNYCPS"
    />
  </section>
</template>

<script setup>
import PvButton from 'primevue/button';
import { onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';

import {
  SignInError,
  IdentifierInput,
  Providers,
  PasswordInput,
  MagicLinkBackButton,
  SignInEmailChip,
  SuccessAlert,
  SignInHeader,
} from './components';

import { useSignInForm } from './composables/useSignInForm';
import { useProviders } from './composables/useProviders';
import { useAuth } from './composables/useAuth';

/* ---- store & router ---- */
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

/* ---- form state (single source of truth) ---- */
const {
  email,
  password,
  invalid,
  showPasswordField,
  multipleProviders,
  emailLinkSent,
  hideProviders,
  onEmailUpdate,
  onPasswordUpdate,
  resetSignInUI,
  availableProviders,
  hasCheckedProviders,
  isUsername,
} = useSignInForm();

/* ---- auth flows, forgot password, success alert ---- */
const {
  roarfirekit,
  authWithGoogle,
  authWithClever,
  authWithClassLink,
  authWithNYCPS,
  authWithEmailPassword,
  sendMagicLink,
  handleForgotPassword,
  handleBackToPassword,
  showGenericProviders,
  showScopedProviders,
  showSuccessAlert,
  successEmail,
} = useAuth({
  authStore,
  router,
  route,
  email,
  password,
  invalid,
  emailLinkSent,
  showPasswordField,
  resetSignInUI,
});

/* ---- provider discovery & chooser ---- */
const { checkAvailableProviders } = useProviders({
  email,
  isUsername,
  availableProviders,
  hasCheckedProviders,
  multipleProviders,
  hideProviders,
  showPasswordField,
  roarfirekit,
  authWithGoogle,
  authWithClever,
  authWithClassLink,
  authWithNYCPS,
  invalid,
});

/* ---- Automatic SSO auth when redirected from OAuth landing pages ---- */
onMounted(() => {
  if (authStore.cleverOAuthRequested) {
    authStore.cleverOAuthRequested = false;
    authWithClever();
  }
  if (authStore.classLinkOAuthRequested) {
    authStore.classLinkOAuthRequested = false;
    authWithClassLink();
  }
  if (authStore.nycpsOAuthRequested) {
    authStore.nycpsOAuthRequested = false;
    authWithNYCPS();
  }
});
</script>
