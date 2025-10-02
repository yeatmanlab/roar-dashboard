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
          <SignIn
            :invalid="incorrect"
            @submit="authWithEmail({ email, password: modalPassword, useLink: false, usePassword: true })"
            @checkproviders="checkAvailableProviders"
            @update:email="email = $event"
          />
        </section>
        <section v-if="hasCheckedProviders" class="flex w-full flex-column">
          <div class="flex flex-row w-full align-content-center justify-content-center">
            <PvButton
              v-if="availableProviders.includes(AUTH_SSO_PROVIDERS.GOOGLE)"
              label="Sign in with Google"
              class="flex p-1 mr-2 ml-2 text-center text-black surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 3rem; color: black"
              data-cy="sign-in__google-sso"
              @click="authWithGoogle"
            >
              <img src="../assets/provider-google-logo.svg" alt="The Google Logo" class="flex mr-2 w-2" />
              <span>Login with Google</span>
            </PvButton>
            <PvButton
              v-if="availableProviders.includes(AUTH_SSO_PROVIDERS.CLEVER)"
              class="flex p-1 mr-2 ml-2 surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 3rem; color: black"
              data-cy="sign-in__clever-sso"
              @click="authWithClever"
            >
              <img src="../assets/provider-clever-logo.svg" alt="The Clever Logo" class="flex mr-2" />
              <span>Login with Clever</span>
            </PvButton>
            <PvButton
              v-if="availableProviders.includes(AUTH_SSO_PROVIDERS.CLASSLINK)"
              class="flex p-1 mr-2 ml-2 text-black surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 3rem; color: black"
              data-cy="sign-in__classlink-sso"
              @click="authWithClassLink"
            >
              <img src="../assets/provider-classlink-logo.png" alt="The ClassLink Logo" class="flex mr-2 w-2" />
              <span>Login with ClassLink</span>
            </PvButton>
          </div>
        </section>
        <!-- <section class="signin-option-container signin-option-providers">
          <div class="flex flex-row w-full justify-content-center">
            <p class="text-sm signin-option-title">Don't have an account yet?</p>
            <PvButton label="Register" class="w-3 signin-button" @click="router.push({ name: 'Register' })" />
          </div>
        </section> -->
        <div class="flex flex-row w-full justify-content-end">
          <small
            class="hover:underline flex flex-row mt-3 justify-content-end font-bold text-primary cursor-pointer text-base"
            @click="handleForgotPassword"
            >Forgot password?</small
          >
        </div>
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
        <div v-if="signInMethods.includes('google')" class="flex">
          <PvButton
            label="Sign in with Google"
            class="flex p-1 mr-1 text-center surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
            style="border-radius: 3rem; height: 3rem"
            @click="authWithGoogle"
          >
            <img src="../assets/provider-google-logo.svg" alt="The Google Logo" class="flex mr-2 w-2" />
            <span>Continue with Google</span>
          </PvButton>
        </div>
        <div v-if="signInMethods.includes(AUTH_SSO_PROVIDERS.CLEVER)">
          <PvButton
            class="flex p-1 mr-1 surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
            style="border-radius: 3rem; height: 3rem"
            @click="authWithClever"
          >
            <img src="../assets/provider-clever-logo.svg" alt="The Clever Logo" class="flex mr-2 w-2" />
            <span>Continue with Clever</span>
          </PvButton>
        </div>
        <div v-if="signInMethods.includes(AUTH_SSO_PROVIDERS.CLASSLINK)">
          <PvButton
            class="flex p-1 mr-1 surface-0 border-black-alpha-10 justify-content-center hover:border-primary hover:surface-ground"
            style="border-radius: 3rem; height: 3rem"
            @click="authWithClassLink"
          >
            <img src="../assets/provider-classlink-logo.png" alt="The ClassLink Logo" class="flex mr-2 w-2" />
            <span>Continue with ClassLink</span>
          </PvButton>
        </div>
        <small v-if="hasCheckedProviders" class="text-link sign-in-method-link" @click="handleForgotPassword"
          >Forgot password?</small
        >
        <div v-if="signInMethods.includes('password')" class="flex flex-row gap-2">
          <PvPassword
            v-model="modalPassword"
            placeholder="Password"
            :input-props="{ autocomplete: 'current-password' }"
            :feedback="false"
          />
          <!-- <PvButton
            class="flex p-3 border-none border-round hover:bg-black-alpha-20"
            :label="$t('authSignIn.buttonLabel') + ' &rarr;'"
            @click="checkAvailableProviders"
          /> -->
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
  <RoarModal
    :is-enabled="forgotPasswordModalOpen"
    title="Forgot Password"
    subtitle="Enter your email to reset your password"
    small
    @modal-closed="forgotPasswordModalOpen = false"
  >
    <template #default>
      <div class="flex flex-column">
        <label>Email</label>
        <PvInputText v-model="forgotEmail" />
      </div>
    </template>
    <template #footer>
      <PvButton
        tabindex="0"
        class="p-2 bg-white border-none border-round text-primary hover:surface-200"
        text
        label="Cancel"
        outlined
        @click="closeForgotPasswordModal"
      ></PvButton>
      <PvButton
        tabindex="0"
        class="p-2 text-white border-none border-round bg-primary hover:surface-400"
        label="Send Reset Email"
        @click="sendResetEmail"
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
import PvInputText from 'primevue/inputtext';
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
const availableProviders = ref([]);
const hasCheckedProviders = ref(false);
const forgotPasswordModalOpen = ref(false);
const forgotEmail = ref('');

const { spinner, ssoProvider, routeToProfile, roarfirekit } = storeToRefs(authStore);
const warningModalOpen = ref(false);

const checkAvailableProviders = async () => {
  await getProviders(email.value);
};
function handleForgotPassword() {
  forgotPasswordModalOpen.value = true;
}
function closeForgotPasswordModal() {
  forgotPasswordModalOpen.value = false;
  forgotEmail.value = '';
}
function sendResetEmail() {
  roarfirekit.value.sendPasswordResetEmail(forgotEmail.value);
  closeForgotPasswordModal();
}

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

const authWithClever = () => {
  if (process.env.NODE_ENV === 'development' && !window.Cypress) {
    authStore.signInWithCleverPopup();
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

const authWithEmail = async (state) => {
  // If username is supplied instead of email
  // turn it into our internal auth email
  await getProviders(email.value);
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
