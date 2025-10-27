<template>
  <div v-if="spinner" class="loading-blur">
    <AppSpinner />
  </div>
  <div id="signin-container" class="bg-gray-50">
    <section id="signin">
      <header class="mb-0 pb-0">
        <div class="signin-logo">
          <ROARLogoShort />
        </div>
      </header>
      <div
        v-if="multipleProviders"
        class="flex flex-row align-content-center justify-content-center gap-1 w-full m-0 p-0"
      >
        <div class="justify-content-center align-content-center">
          <h1 class="text-color text-center">{{ $t('pageSignIn.ChooseYourProvider') }}</h1>
          <p class="text-center">{{ $t('pageSignIn.ChooseYourProviderDescription') }}</p>
        </div>
      </div>
      <div v-else-if="emailLinkSent">
        <div class="flex flex-row align-content-center justify-content-center gap-1 w-full m-0 p-0">
          <div class="justify-content-center align-content-center">
            <h1 class="text-color text-center">{{ $t('pageSignIn.checkInbox') }}</h1>
            <p class="text-center">{{ $t('pageSignIn.checkInboxDescription') }}</p>
          </div>
        </div>
      </div>
      <div
        v-else-if="showPasswordField"
        class="flex flex-row align-content-center justify-content-center gap-1 w-full m-0 p-0"
      >
        <div class="justify-content-center align-content-center">
          <h1 class="text-color text-center">{{ $t('pageSignIn.EnterYourPassword') }}</h1>
          <p class="text-center">{{ $t('pageSignIn.almostTime') }}</p>
        </div>
      </div>
      <div v-else class="flex flex-row align-content-center justify-content-center gap-1 w-full m-0 p-0">
        <div class="justify-content-center align-content-center">
          <h1 class="text-color text-center">{{ $t('pageSignIn.welcome') }}</h1>
          <p class="text-center">{{ $t('pageSignIn.login') }}</p>
        </div>
      </div>
      <section class="signin-options">
        <section class="flex w-full m-4 mt-2 flex-column align-content-center justify-content-center border-500">
          <SignIn
            :invalid="incorrect"
            :show-password-field="showPasswordField"
            :multiple-providers="multipleProviders"
            :email-link-sent="emailLinkSent"
            @submit="authWithEmail"
            @update:email="email = $event"
            @check-providers="checkAvailableProviders"
            @reset="resetSignInUI"
            @magic-link="sendMagicLink"
            @cancel-magic-link="emailLinkSent = false"
          />
          <div v-if="!hideProviders" class="flex flex-column w-full align-content-center justify-content-center">
            <PvButton
              v-if="showGenericProviders || (showScopedProviders && availableProviders.includes('clever'))"
              class="flex h-1 m-1 w-full surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
              data-cy="sign-in__clever-sso"
              @click="authWithClever"
            >
              <div class="flex flex-row align-items-center w-full">
                <div class="flex justify-content-end w-5">
                  <img src="../assets/provider-clever-logo.svg" alt="The Clever Logo" class="flex p-1 provider-logo" />
                </div>
                <div class="flex justify-content-start w-full pl-3">
                  <span> {{ $t('authSignIn.signInWith') }} Clever</span>
                </div>
              </div>
            </PvButton>
            <PvButton
              v-if="showGenericProviders || (showScopedProviders && availableProviders.includes('classlink'))"
              class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
              data-cy="sign-in__classlink-sso"
              @click="authWithClassLink"
            >
              <div class="flex flex-row align-items-center w-full">
                <div class="flex justify-content-end w-5">
                  <img
                    src="../assets/provider-classlink-logo.png"
                    alt="The ClassLink Logo"
                    class="flex p-1 provider-logo"
                  />
                </div>
                <div class="flex justify-content-start w-full pl-3">
                  <span> {{ $t('authSignIn.signInWith') }} ClassLink</span>
                </div>
              </div>
            </PvButton>
            <PvButton
              v-if="showGenericProviders || (showScopedProviders && availableProviders.includes('nycps'))"
              class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
              data-cy="sign-in__classlink-sso"
              @click="authWithNYCPS"
            >
              <div class="flex flex-row align-items-center w-full">
                <div class="flex justify-content-end w-5">
                  <img
                    src="../assets/provider-nycps-logo.jpg"
                    alt="The NYC Public Schools Logo"
                    class="flex p-1 provider-logo"
                  />
                </div>
                <div class="flex justify-content-start w-full pl-3">
                  <span> {{ $t('authSignIn.signInWith') }} NYCPS</span>
                </div>
              </div>
            </PvButton>
            <PvButton
              v-if="showScopedProviders && availableProviders.includes('google')"
              class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
              data-cy="sign-in__google-sso"
              @click="authWithGoogle"
            >
              <div class="flex flex-row align-items-center w-full">
                <div class="flex justify-content-end w-5">
                  <img src="../assets/provider-google-logo.svg" alt="The Google Logo" class="flex p-1 provider-logo" />
                </div>
                <div class="flex justify-content-start w-full pl-3">
                  <span> {{ $t('authSignIn.signInWith') }} Google</span>
                </div>
              </div>
            </PvButton>
          </div>
        </section>
      </section>
      <footer class="flex flex-row bg-gray-50 m-0 p-0">
        <a href="#trouble" class="hidden">{{ $t('pageSignIn.havingTrouble') }}</a>
        <div class="flex flex-row w-full">
          <div class="w-full">
            <LanguageSelector />
          </div>
          <div class="w-5 justify-content-end flex flex-row gap-0">
            <a
              :href="TERMS_OF_SERVICE_DOCUMENT_PATH"
              class="text-400 w-full inline-block text-sm pt-2 text-right underline hover:text-primary"
              target="_blank"
              >{{ $t('pageSignIn.Terms') }}</a
            >
            <a
              :href="TERMS_OF_SERVICE_DOCUMENT_PATH"
              class="text-400 w-full inline-block text-sm pt-2 text-right underline hover:text-primary"
              target="_blank"
              >{{ $t('pageSignIn.Privacy') }}</a
            >
          </div>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, toRaw, onBeforeUnmount, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { setUser } from '@sentry/vue';
import PvButton from 'primevue/button';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import { useAuthStore } from '@/store/auth';
import { isMobileBrowser } from '@/helpers';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import { fetchDocById } from '@/helpers/query/utils';
import { AUTH_SSO_PROVIDERS, TERMS_OF_SERVICE_DOCUMENT_PATH } from '@/constants/auth';
import { APP_ROUTES } from '@/constants/routes';
import SignIn from '@/components/auth/SignIn.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';

const incorrect = ref(false);
const hideProviders = ref(false);
const emailLinkSent = ref(false);
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const { spinner, ssoProvider, roarfirekit, routeToProfile } = storeToRefs(authStore);
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

const modalPassword = ref('');

const sendMagicLink = (email) => {
  authStore.initiateLoginWithEmailLink({ email: email }).then(() => {
    emailLinkSent.value = true;
  });
};

const authWithClever = () => {
  if (process.env.NODE_ENV === 'development' && !window.Cypress) {
    authStore.signInWithCleverPopup().then(async () => {
      if (authStore.uid) {
        const userClaims = await fetchDocById('userClaims', authStore.uid);
        authStore.userClaims = userClaims;
      }
      if (authStore.roarUid) {
        const userData = await fetchDocById('users', authStore.roarUid);
        authStore.userData = userData;
        setUser({ id: authStore.roarUid, userType: userData.userType });
      }
    });
  } else {
    authStore.signInWithCleverRedirect();
  }
  spinner.value = true;
};

const authWithClassLink = () => {
  if (isMobileBrowser()) {
    authStore.signInWithClassLinkRedirect();
    spinner.value = true;
  } else {
    authStore.signInWithClassLinkRedirect();
    spinner.value = true;
  }
};

const authWithNYCPS = () => {
  if (process.env.NODE_ENV === 'development' && !window.Cypress) {
    authStore.signInWithNYCPSPopup().then(async () => {
      if (authStore.uid) {
        const userClaims = await fetchDocById('userClaims', authStore.uid);
        authStore.userClaims = userClaims;
      }
      if (authStore.roarUid) {
        const userData = await fetchDocById('users', authStore.roarUid);
        authStore.userData = userData;
        setUser({ id: authStore.roarUid, userType: userData.userType });
      }
    });
  } else {
    authStore.signInWithNYCPSRedirect();
  }
  spinner.value = true;
};

const authWithGoogle = () => {
  if (isMobileBrowser()) {
    authStore.signInWithGoogleRedirect();
  } else {
    authStore
      .signInWithGooglePopup()
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
      })
      .catch((e) => {
        const errorCode = e.code;
        if (errorCode === 'auth/email-already-in-use') {
          // User tried to register with an email that is already linked to a firebase account.
          spinner.value = false;
        } else {
          spinner.value = false;
        }
      });

    spinner.value = true;
  }
};

const authWithEmail = (state) => {
  // If username is supplied instead of email
  // turn it into our internal auth email
  incorrect.value = false;
  let creds = toRaw(state);
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
};

const email = ref('');

const signInMethods = ref([]);

const availableProviders = ref([]);
const hasCheckedProviders = ref(false);
const multipleProviders = ref(false);

const getProviders = async () => {
  const authKit = roarfirekit.value;
  if (!authKit) {
    return [];
  }
  const emailProvider = (email.value || '').trim().toLowerCase();
  const raw = await authKit.fetchEmailAuthMethods(emailProvider);
  availableProviders.value = await normalizeProviders(raw || []);
  hasCheckedProviders.value = true;
};

const showPasswordField = ref(false);

const checkAvailableProviders = async (em) => {
  email.value = (em || '').trim();

  // Username path
  const isUsername = !!email.value && !email.value.includes('@');
  if (isUsername) {
    showPasswordField.value = true;
    availableProviders.value = ['password'];
    hideProviders.value = true;
    return;
  }

  await getProviders(email.value);

  // Check if there are multiple SSO options
  const ssoProviders = availableProviders.value.filter((p) => ['google', 'clever', 'classlink', 'nycps'].includes(p));
  multipleProviders.value = ssoProviders.length > 1;

  if (multipleProviders.value) {
    // You might want to show a selection menu instead of auto-login
    hideProviders.value = false;
    showPasswordField.value = false;
    return;
  }

  // Auto-SSO if there’s only one
  if (availableProviders.value.includes('google')) authWithGoogle();
  if (availableProviders.value.includes('clever')) authWithClever();
  if (availableProviders.value.includes('classlink')) authWithClassLink();
  if (availableProviders.value.includes('nycps')) authWithNYCPS();

  // Show password field if needed
  showPasswordField.value =
    availableProviders.value.includes('password') ||
    availableProviders.value.includes('link') ||
    availableProviders.value.length === 0;
  hideProviders.value = true;
};

const normalizeProviders = async (ids = []) => {
  const out = new Set();
  for (const id of ids) {
    const emailFromProvider = String(id).toLowerCase();
    if (emailFromProvider === 'password' || emailFromProvider === 'emaillink') out.add('password');
    if (
      emailFromProvider === 'google.com' ||
      emailFromProvider === 'google' ||
      emailFromProvider === AUTH_SSO_PROVIDERS.GOOGLE
    ) {
      out.add(AUTH_SSO_PROVIDERS.GOOGLE);
    }
    if (emailFromProvider.startsWith('oidc.') && emailFromProvider.includes('clever'))
      out.add(AUTH_SSO_PROVIDERS.CLEVER);
    if (emailFromProvider.startsWith('oidc.') && emailFromProvider.includes('classlink'))
      out.add(AUTH_SSO_PROVIDERS.CLASSLINK);
    if (emailFromProvider.startsWith('oidc.') && emailFromProvider.includes('nycps')) out.add(AUTH_SSO_PROVIDERS.NYCPS);
  }
  return [...out];
};

function resetSignInUI() {
  email.value = '';
  incorrect.value = false;
  hideProviders.value = false;
  showPasswordField.value = false;
  signInMethods.value = [];
  availableProviders.value = [];
  hasCheckedProviders.value = false;
  modalPassword.value = '';
  spinner.value = false;
  multipleProviders.value = false;
}

const showGenericProviders = computed(() => !hasCheckedProviders.value && !showPasswordField.value);

const showScopedProviders = computed(() => hasCheckedProviders.value && multipleProviders.value);

onMounted(() => {
  document.body.classList.add('page-signin');
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

.provider-button {
  border-radius: 3rem;
  height: 2.5rem;
  color: black !important;
}
.provider-logo {
  width: 3.5vh;
}
</style>
