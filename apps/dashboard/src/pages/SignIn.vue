<template>
  <div v-if="spinner" class="loading-blur">
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
            @update:email="onEmailUpdate"
            @update:password="onPasswordUpdate"
            @check-providers="checkAvailableProviders"
            @submit="authWithEmailWrapper"
            @forgot-password="handleForgotPasswordWrapper"
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

      <!-- Footer (outside the card, but aligned to its width) -->
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
import { onMounted, onBeforeUnmount, computed, toRaw } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { setUser } from '@sentry/vue';

import { useAuthStore } from '@/store/auth';
import { isMobileBrowser } from '@/helpers';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import { fetchDocById } from '@/helpers/query/utils';
import { TERMS_OF_SERVICE_DOCUMENT_PATH } from '@/constants/auth';
import { APP_ROUTES } from '@/constants/routes';

import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';
import AppSpinner from '@/components/AppSpinner.vue';

import SignInForm from '@/containers/SignIn/SignIn.vue';
import { SignInCard, SignInHeader } from '@/containers/SignIn/components';

import { useSignInForm } from '@/containers/SignIn/composables/useSignInForm';
import { useProviders } from '@/containers/SignIn/composables/useProviders';

/* ---------------- Store / Router ---------------- */
const authStore = useAuthStore();
const { spinner, ssoProvider, roarfirekit } = storeToRefs(authStore);
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
  // local form spinner exists in composable; we keep using store spinner for overlay
  onEmailUpdate,
  onPasswordUpdate,
  resetSignInUI,
  availableProviders,
  hasCheckedProviders,
} = useSignInForm();

/* ---------------- Visibility decisions ---------------- */
/* Keep Google hidden on the first screen (optional) */
const showGenericProviders = computed(() => false);
/* Show district (Clever/ClassLink/NYCPS) on the first screen */
const showScopedProviders = computed(() => !showPasswordField.value && !emailLinkSent.value);

/* Email treated as username if it has no '@' */
const isUsername = computed(() => {
  const v = email.value ?? '';
  return v !== '' && !String(v).includes('@');
});

/* ---------------- Auth: redirect after login ---------------- */
authStore.$subscribe(() => {
  if (authStore.uid) {
    if (ssoProvider.value) router.push({ path: APP_ROUTES.SSO });
    else router.push({ path: redirectSignInPath(route) });
  }
});

/* ---------------- User claims ---------------- */
async function getUserClaims() {
  if (authStore.uid) {
    const userClaims = await fetchDocById('userClaims', authStore.uid);
    authStore.userClaims = userClaims;
  }
  if (authStore.roarUid) {
    const userData = await fetchDocById('users', authStore.roarUid);
    authStore.userData = userData;
    setUser({ id: authStore.roarUid, userType: userData?.userType });
  }
}

/* ---------------- Magic link + password reset ---------------- */
function sendMagicLink(userEmail) {
  authStore.initiateLoginWithEmailLink({ email: userEmail }).then(() => {
    emailLinkSent.value = true;
  });
}
function handleForgotPasswordWrapper() {
  roarfirekit.value?.sendPasswordResetEmail(email.value);
}
function handleBackToPassword() {
  emailLinkSent.value = false;
  showPasswordField.value = true;
}

/* ---------------- SSO flows ---------------- */
function authWithClever() {
  if (process.env.NODE_ENV === 'development' && !window.Cypress) {
    authStore.signInWithCleverPopup().then(getUserClaims);
  } else {
    authStore.signInWithCleverRedirect();
  }
  spinner.value = true;
}
function authWithClassLink() {
  authStore.signInWithClassLinkRedirect();
  spinner.value = true;
}
function authWithNYCPS() {
  if (process.env.NODE_ENV === 'development' && !window.Cypress) {
    authStore.signInWithNYCPSPopup().then(getUserClaims);
  } else {
    authStore.signInWithNYCPSRedirect();
  }
  spinner.value = true;
}
function authWithGoogle() {
  if (isMobileBrowser()) {
    authStore.signInWithGoogleRedirect();
    spinner.value = true;
    return;
  }
  spinner.value = true;
  authStore
    .signInWithGooglePopup()
    .then(getUserClaims)
    .catch(() => {
      spinner.value = false;
    });
}

/* ---------------- Email/password ---------------- */
function authWithEmailWrapper() {
  incorrect.value = false;

  let creds = toRaw({
    email: email.value,
    password: modalPassword.value,
  });

  // username path => convert to internal email
  if (!String(creds.email).includes('@')) {
    creds.email = `${creds.email}@roar-auth.com`;
  }

  authStore
    .logInWithEmailAndPassword(creds)
    .then(async () => {
      await getUserClaims();
      spinner.value = true;
    })
    .catch(() => {
      incorrect.value = true;
      // For unknown codes we still surface invalid; optionally log e.code
    });
}

/* ---------------- Provider discovery (composable) ---------------- */
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
  invalid: incorrect, // clears stale error when chooser appears
});

/* ---------------- Lifecycle ---------------- */
onMounted(() => {
  document.body.classList.add('page-signin');
});
onBeforeUnmount(() => {
  document.body.classList.remove('page-signin');
});
</script>
