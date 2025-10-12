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
      <div class="flex flex-row align-content-center justify-content-center gap-1 w-full">
        <div class="justify-content-end align-content-end">
          <h1>{{ $t('pageSignIn.welcome') }}</h1>
        </div>
        <div class="ml-3 justify-content-end align-content-end">
          <LanguageSelector />
        </div>
        <div class="ml-3 justify-content-end align-content-end">
          <PvButton
            v-tooltip.top="'Click for help on signin'"
            class="p-button-text p-button-rounded m-0 p-0 p-button-plain bg-primary border-2 border-primary hover:surface-200"
            aria-label="Sign in help button"
            @click="toggle($event)"
          >
            <i class="pi pi-question text-white p-2 font-bold m-0 hover:text-primary" style="font-size: 1.1rem"></i>
          </PvButton>
        </div>

        <PvPopover ref="op" append-to="body" style="max-width: 28rem">
          <div class="p-3 text-sm">
            <h3 class="text-xl font-bold mb-2 mt-0">
              {{ $t('authSignIn.superAdminPopover.title') }}
            </h3>

            <ul class="pl-3 mb-3">
              <li v-html="$t('authSignIn.superAdminPopover.emailLine')"></li>
              <li>
                {{ $t('authSignIn.superAdminPopover.chooseOptions') }}
                <ul class="pl-3 mt-1">
                  <li v-html="$t('authSignIn.superAdminPopover.passwordOption')"></li>
                  <li v-html="$t('authSignIn.superAdminPopover.emailLinkOption')"></li>
                </ul>
              </li>
              <li class="mt-1" v-html="$t('authSignIn.superAdminPopover.googleLine')"></li>
            </ul>

            <p class="mt-2 text-600 italic">
              {{ $t('authSignIn.superAdminPopover.notice') }}
            </p>
          </div>
        </PvPopover>
      </div>
      <section class="signin-options">
        <section class="flex w-full m-4 mt-2 flex-column align-content-center justify-content-center border-500">
          <SignIn :invalid="incorrect" @submit="authWithEmail" @update:email="email = $event" />
          <div class="flex flex-column w-full align-content-center justify-content-center">
            <PvButton
              label="Sign in with Google"
              class="flex h-1 m-1 w-full surface-0 border-400 border-round-md justify-content-center hover:border-primary hover:surface-groundd"
              style="border-radius: 3rem; height: 2.5rem; color: black"
              data-cy="sign-in__google-sso"
              @click="authWithGoogle"
            >
              <div class="flex flex-row align-items-center w-full">
                <div class="flex justify-content-end w-6">
                  <img
                    src="../assets/provider-google-logo.svg"
                    alt="The Google Logo"
                    class="flex p-1"
                    style="width: 3.5vh"
                  />
                </div>
                <div class="flex justify-content-start w-full pl-3">
                  <span>{{ $t('authSignIn.signInWith') }} Google</span>
                </div>
              </div>
            </PvButton>
            <!-- <PvButton
              class="flex h-1 m-1 w-full surface-0 border-400 border-round-md justify-content-center hover:border-primary hover:surface-ground"
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
                  <span> Sign in with Clever</span>
                </div>
              </div>
            </PvButton>
            <PvButton
              class="flex h-1 m-1 w-full text-black surface-0 border-400 border-round-md justify-content-center hover:border-primary hover:surface-ground"
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
                  <span> Sign in with ClassLink</span>
                </div>
              </div>
            </PvButton>
            <PvButton
              class="flex h-1 m-1 w-full text-black surface-0 border-400 border-round-md justify-content-center hover:border-primary hover:surface-ground"
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
                  <span> Sign in with NYCPS</span>
                </div>
              </div>
            </PvButton> -->
          </div>
        </section>
        <!-- <section class="signin-option-container signin-option-providers">
            <div class="flex flex-row w-full justify-content-center">
              <p class="text-sm signin-option-title">Don't have an account yet?</p>
              <PvButton label="Register" class="w-3 signin-button" @click="router.push({ name: 'Register' })" />
            </div>
          </section> -->
      </section>
      <footer style="display: none">
        <!-- TODO: figure out a link for this -->
        <a href="#trouble">{{ $t('pageSignIn.havingTrouble') }}</a>
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
import PvPopover from 'primevue/popover';
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

const incorrect = ref(false);
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const { spinner, ssoProvider, routeToProfile, roarfirekit } = storeToRefs(authStore);
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
          openWarningModal();
          spinner.value = false;
        } else {
          spinner.value = false;
        }
      });

    spinner.value = true;
  }
};

const modalPassword = ref('');

const op = ref(null);
const toggle = (event) => {
  op.value.toggle(event);
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
</style>
