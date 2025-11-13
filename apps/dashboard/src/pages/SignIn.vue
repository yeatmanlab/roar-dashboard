<template>
  <div v-if="storeSpinner" class="loading-blur">
    <AppSpinner />
  </div>

  <div id="signin-container-blur" class="bg-gray-50">
    <div class="signin-column">
      <SignInCard class="signin-card">
        <section id="signin" class="m-0 p-0">
          <!-- Logo / header -->
          <header class="mb-0 pb-0">
            <div class="signin-logo">
              <ROARLogoShort />
            </div>
          </header>

          <!-- Title + subtitle -->
          <SignInHeader
            :multiple-providers="multipleProviders"
            :email-link-sent="emailLinkSent"
            :show-password-field="showPasswordField"
          />

          <!-- Main sign-in UI -->
          <SignInForm
            :email="email"
            :password="modalPassword"
            :invalid="incorrect"
            :show-password-field="showPasswordField"
            :multiple-providers="multipleProviders"
            :email-link-sent="emailLinkSent"
            :hide-providers="hideProviders"
            :is-username="isUsername"
            :available-providers="availableProviders"
            :show-generic-providers="showGenericProviders"
            :show-scoped-providers="showScopedProviders"
            :show-success-alert="showSuccessAlert"
            :success-email="successEmail"
            @update:email="onEmailUpdate"
            @update:password="onPasswordUpdate"
            @check-providers="checkAvailableProviders"
            @submit="authWithEmailPassword"
            @forgot-password="handleForgotPassword"
            @magic-link="sendMagicLink(email)"
            @back-to-password="handleBackToPassword"
            @auth-clever="authWithClever"
            @auth-classlink="authWithClassLink"
            @auth-nycps="authWithNYCPS"
            @auth-google="authWithGoogle"
            @clear-email="resetSignInUI"
          />
        </section>
      </SignInCard>

      <!-- Footer (Language, Privacy, Terms) -->
      <footer class="signin-footer">
        <a href="#trouble" class="hidden">{{ $t('pageSignIn.havingTrouble') }}</a>
        <div class="w-full flex">
          <div class="flex-1">
            <LanguageSelector />
          </div>
          <div class="flex gap-2">
            <a
              :href="TERMS_OF_SERVICE_DOCUMENT_PATH"
              class="text-400 inline-block text-sm hover:text-primary pt-2"
              target="_blank"
              >{{ $t('pageSignIn.Privacy') }}</a
            >
            <a
              :href="TERMS_OF_SERVICE_DOCUMENT_PATH"
              class="text-400 inline-block text-sm hover:text-primary pt-2"
              target="_blank"
              >{{ $t('pageSignIn.Terms') }}</a
            >
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { TERMS_OF_SERVICE_DOCUMENT_PATH } from '@/constants/auth';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';
import AppSpinner from '@/components/AppSpinner.vue';
import SignInForm from '@/containers/SignIn/SignIn.vue';
import { SignInCard, SignInHeader } from '@/containers/SignIn/components';
import { useSignInForm } from '@/containers/SignIn/composables/useSignInForm';
import { useProviders } from '@/containers/SignIn/composables/useProviders';
import { useAuth } from '@/containers/SignIn/composables/useAuth';

/* ---------------- Store / Router ---------------- */
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

/* ---------------- Form state (single source of truth) ---------------- */
const {
  email,
  password: modalPassword,
  invalid: incorrect,
  showPasswordField,
  multipleProviders,
  emailLinkSent,
  hideProviders,
  onEmailUpdate,
  onPasswordUpdate,
  resetSignInUI,
  availableProviders,
  hasCheckedProviders,
} = useSignInForm();

const {
  roarfirekit,
  spinner: storeSpinner,
  authWithGoogle,
  authWithClever,
  authWithClassLink,
  authWithNYCPS,
  authWithEmailPassword,
  sendMagicLink,
  handleForgotPassword,
  handleBackToPassword,
  isUsername,
  showGenericProviders,
  showScopedProviders,
  showSuccessAlert,
  successEmail,
} = useAuth({
  authStore,
  router,
  route,
  email,
  password: modalPassword,
  invalid: incorrect,
  emailLinkSent,
  showPasswordField,
  resetSignInUI,
});

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
  invalid: incorrect, // clear stale error when chooser appears
});

onMounted(() => {
  document.body.classList.add('page-signin');
});
onBeforeUnmount(() => {
  document.body.classList.remove('page-signin');
});
</script>
