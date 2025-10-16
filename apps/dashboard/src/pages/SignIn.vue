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
      <div class="flex flex-row align-content-center justify-content-center gap-1 w-full m-0 p-0">
        <div class="justify-content-center align-content-center">
          <h1 class="text-color text-center">{{ $t('pageSignIn.welcome') }}</h1>
          <p class="text-center">{{ $t('pageSignIn.login') }}</p>
        </div>
      </div>
      <section class="signin-options">
        <section class="flex w-full m-4 mt-2 flex-column align-content-center justify-content-center border-500">
          <SignIn
            :invalid="incorrect"
            @submit="authWithEmail"
            @update:email="email = $event"
            @checkproviders="checkAvailableProviders"
          />
          <div class="flex flex-column w-full align-content-center justify-content-center">
            <PvButton
              class="flex h-1 m-1 w-full surface-0 border-200 border-2 border-round-md justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 2.5rem; color: black"
              data-cy="sign-in__clever-sso"
              @click="authWithClever"
            >
              <div class="flex flex-row align-items-center w-full">
                <div class="flex justify-content-end w-6">
                  <img
                    src="../assets/provider-clever-logo.svg"
                    alt="The Clever Logo"
                    class="flex p-1"
                    style="width: 3.5vh"
                  />
                </div>
                <div class="flex justify-content-start w-full pl-3">
                  <span> {{ $t('authSignIn.signInWith') }} Clever</span>
                </div>
              </div>
            </PvButton>
            <PvButton
              class="flex h-1 m-1 w-full text-black surface-0 border-200 border-2 border-round-md justify-content-center hover:border-primary hover:surface-ground"
              style="height: 2.5rem; color: black"
              data-cy="sign-in__classlink-sso"
              @click="authWithClassLink"
            >
              <div class="flex flex-row align-items-center w-full">
                <div class="flex justify-content-end w-6">
                  <img
                    src="../assets/provider-classlink-logo.png"
                    alt="The ClassLink Logo"
                    class="flex p-1"
                    style="width: 3.5vh"
                  />
                </div>
                <div class="flex justify-content-start w-full pl-3">
                  <span> {{ $t('authSignIn.signInWith') }} ClassLink</span>
                </div>
              </div>
            </PvButton>
            <PvButton
              class="flex h-1 m-1 w-full text-black surface-0 border-200 border-2 border-round-md justify-content-center hover:border-primary hover:surface-ground"
              style="height: 2.5rem; color: black"
              data-cy="sign-in__classlink-sso"
              @click="authWithNYCPS"
            >
              <div class="flex flex-row align-items-center w-full">
                <div class="flex justify-content-end w-6">
                  <img
                    src="../assets/provider-nycps-logo.jpg"
                    alt="The NYC Public Schools Logo"
                    class="flex p-1"
                    style="width: 3.5vh"
                  />
                </div>
                <div class="flex justify-content-start w-full pl-3">
                  <span> {{ $t('authSignIn.signInWith') }} NYCPS</span>
                </div>
              </div>
            </PvButton>
          </div>
        </section>
        <!-- <section class="signin-option-container signin-option-providers">
            <div class="flex flex-row w-full justify-content-center">
              <p class="text-sm signin-option-title">Don't have an account yet?</p>
              <PvButton label="Register" class="w-3 signin-button" @click="router.push({ name: 'Register' })" />
            </div>
          </section> -->
      </section>
      <footer class="flex flex-row bg-gray-50 m-0 p-0">
        <!-- TODO: figure out a link for this -->
        <a href="#trouble" style="display: none">{{ $t('pageSignIn.havingTrouble') }}</a>
        <div class="flex flex-row w-full">
          <div class="w-full">
            <LanguageSelector />
          </div>
          <div class="w-5 justify-content-end flex flex-row gap-0">
            <a href="#Terms" class="text-400 w-full inline-block text-sm pt-2 text-right underline hover:text-primary"
              >Terms</a
            >
            <a href="#Privacy" class="text-400 w-full inline-block text-sm pt-2 text-right underline hover:text-primary"
              >Privacy</a
            >
          </div>
        </div>
      </footer>
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
        <div v-if="signInMethods.includes(AUTH_SSO_PROVIDERS.CLEVER)">
          <PvButton
            class="flex p-1 mr-1 surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
            style="border-radius: 3rem; height: 3rem"
            @click="authWithClever"
          >
            <img src="../assets/provider-clever-logo.svg" alt="The Clever Logo" class="flex mr-2 w-2" />
            <span>Clever</span>
          </PvButton>
        </div>
        <div v-if="signInMethods.includes(AUTH_SSO_PROVIDERS.CLASSLINK)">
          <PvButton
            class="flex p-1 mr-1 surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
            style="border-radius: 3rem; height: 3rem"
            @click="authWithClassLink"
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
import { onMounted, ref, toRaw, onBeforeUnmount, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
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
import { roarfirekit } from '@bdelab/roar-firekit';

const incorrect = ref(false);
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const { spinner, ssoProvider, routeToProfile } = storeToRefs(authStore);
const warningModalOpen = ref(false);

authStore.$subscribe(() => {
  if (authStore.uid) {
    if (ssoProvider.value) {
      router.push({ path: APP_ROUTES.SSO });
    } else if (routeToProfile.value) {
      router.push({ path: APP_ROUTES.ACCOUNT_PROFILE });
    } else {
      router.push({ path: redirectSignInPath(route) });
    }
  }
});

const modalPassword = ref('');

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

// const authWithGoogle = () => {
//   if (isMobileBrowser()) {
//     authStore.signInWithGoogleRedirect();
//   } else {
//     authStore
//       .signInWithGooglePopup()
//       .then(async () => {
//         if (authStore.uid) {
//           const userClaims = await fetchDocById('userClaims', authStore.uid);
//           authStore.userClaims = userClaims;
//         }
//         if (authStore.roarUid) {
//           const userData = await fetchDocById('users', authStore.roarUid);
//           authStore.userData = userData;
//           setUser({ id: authStore.roarUid, userType: userData.userType });
//         }
//       })
//       .catch((e) => {
//         const errorCode = e.code;
//         if (errorCode === 'auth/email-already-in-use') {
//           // User tried to register with an email that is already linked to a firebase account.
//           openWarningModal();
//           spinner.value = false;
//         } else {
//           spinner.value = false;
//         }
//       });

//     spinner.value = true;
//   }
// };

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

const displaySignInMethods = computed(() => {
  return signInMethods.value.map((method) => {
    if (method === 'password') return 'Password';
    if (method === AUTH_SSO_PROVIDERS.GOOGLE) return 'Google';
    if (method === AUTH_SSO_PROVIDERS.CLEVER) return 'Clever';
    if (method === AUTH_SSO_PROVIDERS.CLASSLINK) return 'ClassLink';
  });
});

const availableProviders = ref([]);
const hasCheckedProviders = ref(false);

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

const checkAvailableProviders = () => {
  getProviders();
  console.log('availableProviders.value', availableProviders.value);
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
  }
  return [...out];
};

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
  display: flex;
  align-items: center; /* centers logo + text vertically */
  justify-content: center; /* centers content horizontally */
  gap: 0.75rem; /* consistent spacing */
  height: 2.5rem;
  border-radius: 3rem;
  color: black;
  background-color: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  transition:
    border-color 0.2s,
    background-color 0.2s;
}

.provider-button:hover {
  border-color: var(--primary-color);
  background-color: var(--surface-ground);
}

.provider-logo {
  height: 1.5rem; /* consistent height */
  width: auto; /* auto width for varying aspect ratios */
  display: block;
}

.provider-text {
  font-size: 1rem;
  line-height: 1;
}
</style>
