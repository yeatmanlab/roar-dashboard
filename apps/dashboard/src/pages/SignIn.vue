<template>
  <div v-if="spinner" class="loading-blur">
    <AppSpinner />
  </div>
  <div id="signin-container">
    <section id="signin">
      <header>
        <div class="signin-logo">
          <ROARLogoShort />
        </div>
      </header>
      <h1>{{ $t('pageSignIn.welcome') }}</h1>
      <section class="signin-options">
        <section class="signin-option-container signin-option-userpass">
          <h4 class="signin-option-title">{{ $t('pageSignIn.login') }}</h4>
          <div id="languageSelect" class="flex m-4 justify-content-center">
            <LanguageSelector class="w-7" />
          </div>

          <div v-if="ssoError" class="mx-4 mb-3">
            <Alert :variant="ALERT_VARIANTS.DESTRUCTIVE">
              <AlertTitle>{{ ssoError.title }}</AlertTitle>
              <AlertDescription>{{ ssoError.message }}</AlertDescription>
            </Alert>
          </div>

          <SignIn :invalid="incorrect" @submit="authWithEmail" @update:email="email = $event" />
        </section>
        <section class="flex w-full flex-column">
          <h4
            class="flex flex-wrap-reverse mt-1 mb-3 font-bold align-content-center justify-content-center text-md text-500"
          >
            {{ $t('pageSignIn.loginWith') }}
          </h4>
          <div class="flex flex-row w-full align-content-center justify-content-center">
            <PvButton
              label="Sign in with Google"
              class="flex p-1 mr-2 ml-2 w-3 text-center text-black surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 3rem; color: black"
              data-cy="sign-in__google-sso"
              @click="authWithSSO(AUTH_SSO_PROVIDERS.GOOGLE)"
            >
              <img src="../assets/provider-google-logo.svg" alt="The Google Logo" class="flex mr-2 w-2" />
              <span>Google</span>
            </PvButton>
            <PvButton
              class="flex p-1 mr-2 ml-2 w-3 surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 3rem; color: black"
              data-cy="sign-in__clever-sso"
              @click="authWithSSO(AUTH_SSO_PROVIDERS.CLEVER)"
            >
              <img src="../assets/provider-clever-logo.svg" alt="The Clever Logo" class="flex mr-2 w-2" />
              <span>Clever</span>
            </PvButton>
            <PvButton
              class="flex p-1 mr-2 ml-2 w-3 text-black surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 3rem; color: black"
              data-cy="sign-in__classlink-sso"
              @click="authWithSSO(AUTH_SSO_PROVIDERS.CLASSLINK)"
            >
              <img src="../assets/provider-classlink-logo.png" alt="The ClassLink Logo" class="flex mr-2 w-2" />
              <span>ClassLink</span>
            </PvButton>
            <PvButton
              class="flex p-1 mr-2 ml-2 w-3 text-black surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 3rem; color: black"
              data-cy="sign-in__classlink-sso"
              @click="authWithSSO(AUTH_SSO_PROVIDERS.NYCPS)"
            >
              <!-- NYCPS Logo needs to be slightly wider as it is not a square -->
              <img
                src="../assets/provider-nycps-logo.jpg"
                alt="The NYC Public Schools Logo"
                class="flex mr-2"
                style="width: 21%"
              />
              <span>NYCPS</span>
            </PvButton>
          </div>
        </section>
      </section>
    </section>
  </div>

  <RoarModal
    :is-enabled="warningModalOpen"
    title="Email is already associated with an account"
    subtitle=""
    icon="pi-exclamation-triangle"
    small
    @modal-closed="handleWarningModalClose"
  >
    <template #default>
      The email <span class="font-bold">{{ email }}</span> is already in use using
      {{ displaySignInMethods.slice(0, -1).join(', ') + ' or ' + displaySignInMethods.slice(-1) }}. If this is you,
      click to sign in below.
      <div class="flex gap-2 my-2 align-items-center flex-column">
        <div v-if="signInMethods.includes('google')" class="flex">
          <PvButton
            label="Sign in with Google"
            class="flex p-1 mr-1 text-center surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
            style="border-radius: 3rem; height: 3rem"
            @click="authWithSSO(AUTH_SSO_PROVIDERS.GOOGLE)"
          >
            <img src="../assets/provider-google-logo.svg" alt="The Google Logo" class="flex mr-2 w-2" />
            <span>Google</span>
          </PvButton>
        </div>
        <div v-if="signInMethods.includes(AUTH_SSO_PROVIDERS.CLEVER)">
          <PvButton
            class="flex p-1 mr-1 surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
            style="border-radius: 3rem; height: 3rem"
            @click="authWithSSO(AUTH_SSO_PROVIDERS.CLEVER)"
          >
            <img src="../assets/provider-clever-logo.svg" alt="The Clever Logo" class="flex mr-2 w-2" />
            <span>Clever</span>
          </PvButton>
        </div>
        <div v-if="signInMethods.includes(AUTH_SSO_PROVIDERS.CLASSLINK)">
          <PvButton
            class="flex p-1 mr-1 surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
            style="border-radius: 3rem; height: 3rem"
            @click="authWithSSO(AUTH_SSO_PROVIDERS.CLASSLINK)"
          >
            <img src="../assets/provider-classlink-logo.png" alt="The ClassLink Logo" class="flex mr-2 w-2" />
            <span>ClassLink</span>
          </PvButton>
        </div>
        <div v-if="signInMethods.includes('password')" class="flex flex-row gap-2">
          <PvPassword
            v-model="modalPassword"
            placeholder="Password"
            :input-props="{ autocomplete: 'current-password' }"
            :feedback="false"
          />
          <PvButton
            class="flex p-3 border-none border-round hover:bg-black-alpha-20"
            :label="$t('authSignIn.buttonLabel') + ' &rarr;'"
            @click="authWithEmail({ email, password: modalPassword, useLink: false, usePassword: true })"
          />
        </div>
      </div>
      You will then be directed to your profile page where you can link different authentication providers.
    </template>
    <template #footer>
      <PvButton
        tabindex="0"
        class="p-2 bg-white border-none border-round text-primary hover:surface-200"
        text
        label="Back to Sign In"
        outlined
        @click="handleWarningModalClose"
      ></PvButton>
    </template>
  </RoarModal>
</template>

<script setup>
import { onMounted, ref, toRaw, onBeforeUnmount, computed, defineAsyncComponent } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { setUser } from '@sentry/vue';
import PvButton from 'primevue/button';
import PvPassword from 'primevue/password';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import { useAuthStore } from '@/store/auth';
import { isMobileBrowser } from '@/helpers';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import { fetchDocById } from '@/helpers/query/utils';
import { AUTH_SSO_PROVIDERS } from '@/constants/auth';
import { APP_ROUTES } from '@/constants/routes';
import RoarModal from '@/components/modals/RoarModal.vue';
import SignIn from '@/components/auth/SignIn.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';

// Lazy-load Alert components
const Alert = defineAsyncComponent(() => import('@/components/Alert').then((m) => m.Alert));
const AlertTitle = defineAsyncComponent(() => import('@/components/Alert').then((m) => m.AlertTitle));
const AlertDescription = defineAsyncComponent(() => import('@/components/Alert').then((m) => m.AlertDescription));

import { FIREBASE_FUNCTIONS_ERROR_CODES, FIREBASE_FUNCTIONS_ERROR_REASONS } from '@/constants/firebase';
import { ALERT_VARIANTS } from '../components/Alert';

const { t } = useI18n();
const incorrect = ref(false);
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

// SSO error state
const ssoError = ref(null); // { title: string, message: string } or null

const { spinner, ssoProvider, roarfirekit } = storeToRefs(authStore);
const warningModalOpen = ref(false);

authStore.$subscribe(() => {
  if (authStore.uid) {
    if (ssoProvider.value) {
      router.push({ path: APP_ROUTES.SSO });
      // } else if (routeToProfile.value) {
      //   router.push({ path: APP_ROUTES.ACCOUNT_PROFILE });
    } else {
      router.push({ path: redirectSignInPath(route) });
    }
  }
});

/**
 * Configuration for SSO providers
 *
 * Defines the behavior for each provider (popup vs redirect logic) until we refactor the auth flow and remove the need
 * for different popup and redirect methods.
 */
const SSO_CONFIG = {
  [AUTH_SSO_PROVIDERS.GOOGLE]: {
    displayName: 'Google',
    usePopup: () => !isMobileBrowser(),
    popupMethod: () => authStore.signInWithGooglePopup(),
    redirectMethod: () => authStore.signInWithGoogleRedirect(),
  },
  [AUTH_SSO_PROVIDERS.CLEVER]: {
    displayName: 'Clever',
    usePopup: () => process.env.NODE_ENV === 'development' && !window.Cypress,
    popupMethod: () => authStore.signInWithCleverPopup(),
    redirectMethod: () => authStore.signInWithCleverRedirect(),
  },
  [AUTH_SSO_PROVIDERS.CLASSLINK]: {
    displayName: 'ClassLink',
    usePopup: () => false, // ClassLink always uses redirect
    redirectMethod: () => authStore.signInWithClassLinkRedirect(),
  },
  [AUTH_SSO_PROVIDERS.NYCPS]: {
    displayName: 'NYCPS',
    usePopup: () => process.env.NODE_ENV === 'development' && !window.Cypress,
    popupMethod: () => authStore.signInWithNYCPSPopup(),
    redirectMethod: () => authStore.signInWithNYCPSRedirect(),
  },
};

/**
 * Unified SSO authentication handler
 * @param {string} provider - The SSO provider constant (from AUTH_SSO_PROVIDERS)
 */
const authWithSSO = async (provider) => {
  const config = SSO_CONFIG[provider];

  if (!config) {
    console.error(`Unknown SSO provider: ${provider}`);
    return;
  }

  // Clear any previous SSO errors
  ssoError.value = null;

  // Common post-authentication logic
  const handleAuthSuccess = async () => {
    if (authStore.uid) {
      const userClaims = await fetchDocById('userClaims', authStore.uid);
      authStore.userClaims = userClaims;
    }
    if (authStore.roarUid) {
      const userData = await fetchDocById('users', authStore.roarUid);
      authStore.userData = userData;
      setUser({ id: authStore.roarUid, userType: userData.userType });
    }
  };

  // Show loading spinner
  spinner.value = true;

  // Handle authentication
  try {
    if (config.usePopup()) {
      await config.popupMethod();
      await handleAuthSuccess();
      // Turn off spinner after successful popup authentication
      spinner.value = false;
    } else {
      // For redirect, leave spinner on - page will navigate away
      config.redirectMethod();
    }
  } catch (error) {
    handleSSOError(error, config.displayName); // handleSSOError will turn off the spinner
  }
};

const modalPassword = ref('');

const authWithEmail = (state) => {
  // If username is supplied instead of email
  // turn it into our internal auth email
  incorrect.value = false;
  let creds = toRaw(state);
  if (creds.useLink && !creds.usePassword) {
    authStore.initiateLoginWithEmailLink({ email: creds.email }).then(() => {
      router.push({ name: 'AuthEmailSent' });
    });
  } else {
    if (!creds.email.includes('@')) {
      creds.email = `${creds.email}@roar-auth.com`;
    }

    authStore
      .logInWithEmailAndPassword(creds)
      .then(async () => {
        if (authStore.uid) {
          const userClaims = await fetchDocById('userClaims', authStore.uid);
          authStore.userClaims = userClaims;
        }
        if (authStore.roarUid) {
          const userData = await fetchDocById('users', authStore.roarUid);
          authStore.userData = userData;
          setUser({ id: authStore.roarUid, userType: userData.userType });
        }

        spinner.value = true;
      })
      .catch((e) => {
        incorrect.value = true;
        if (['auth/user-not-found', 'auth/wrong-password'].includes(e.code)) {
          return;
        } else {
          throw e;
        }
      });
  }
};

const handleWarningModalClose = () => {
  authStore.routeToProfile = true;
  warningModalOpen.value = false;
};

const email = ref('');

const signInMethods = ref([]);

const openWarningModal = async () => {
  signInMethods.value = await roarfirekit.value.fetchEmailAuthMethods(email.value);
  warningModalOpen.value = true;
};

const displaySignInMethods = computed(() => {
  return signInMethods.value.map((method) => {
    if (method === 'password') return 'Password';
    if (method === AUTH_SSO_PROVIDERS.GOOGLE) return 'Google';
    if (method === AUTH_SSO_PROVIDERS.CLEVER) return 'Clever';
    if (method === AUTH_SSO_PROVIDERS.CLASSLINK) return 'ClassLink';
  });
});

/**
 * Unified error handler for SSO authentication errors
 * @param {Error} error - The error object from Firebase Auth
 * @param {string} providerName - The display name of the SSO provider (e.g., 'Google', 'Clever', 'ClassLink', 'NYCPS')
 */
const handleSSOError = (error, providerName) => {
  const errorCode = error.code;
  const errorMessage = error.message;

  // Turn off spinner
  spinner.value = false;

  // Check if the auth provider has been disabled
  if (
    errorCode === FIREBASE_FUNCTIONS_ERROR_CODES.AUTH_INTERNAL &&
    errorMessage.includes(FIREBASE_FUNCTIONS_ERROR_REASONS.AUTH_PROVIDER_DISABLED)
  ) {
    ssoError.value = {
      title: t('pageSignIn.ssoErrorTitle'),
      message: t('pageSignIn.ssoProviderDisabledMessage', { providerName }),
    };
    return;
  }

  // Check if email is already in use
  if (errorCode === FIREBASE_FUNCTIONS_ERROR_CODES.EMAIL_ALREADY_IN_USE) {
    openWarningModal();
    return;
  }

  // Handle popup closed by user
  if (
    [
      FIREBASE_FUNCTIONS_ERROR_CODES.POPUP_CLOSED_BY_USER,
      FIREBASE_FUNCTIONS_ERROR_CODES.CANCELLED_POPUP_REQUEST,
    ].includes(errorCode)
  ) {
    // Silently ignore as user intentionally closed the popup
    return;
  }

  // Generic error handling
  console.error(`SSO Error / ${providerName}:`, error);

  ssoError.value = {
    title: t('pageSignIn.ssoErrorTitle'),
    message: t('pageSignIn.ssoGenericErrorMessage'),
  };
};

onMounted(() => {
  document.body.classList.add('page-signin');
  if (authStore.cleverOAuthRequested) {
    authStore.cleverOAuthRequested = false;
    authWithSSO(AUTH_SSO_PROVIDERS.CLEVER);
  }
  if (authStore.classLinkOAuthRequested) {
    authStore.classLinkOAuthRequested = false;
    authWithSSO(AUTH_SSO_PROVIDERS.CLASSLINK);
  }
  if (authStore.nycpsOAuthRequested) {
    authStore.nycpsOAuthRequested = false;
    authWithSSO(AUTH_SSO_PROVIDERS.NYCPS);
  }
});

onBeforeUnmount(() => {
  document.body.classList.remove('page-signin');
});
</script>

<style scoped>
.loading-blur {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  background-color: rgba(255, 255, 255, 0.7);
  padding-top: 21vh;
}
input.p-inputtext.p-component.p-password-input {
  width: 100%;
}
div#password {
  width: 100%;
}
</style>
