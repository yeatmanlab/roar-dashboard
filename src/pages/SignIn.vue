<template>
  <div v-if="spinner" class="loading-blur">
    <AppSpinner />
  </div>
  <div id="signin-container">
    <section id="signin">
      <header>
        <div class="signin-logo">
          <PvImage v-if="isLevante" src="/LEVANTE/Levante_Logo.png" alt="LEVANTE Logo" width="200" />
          <ROARLogoShort v-else />
        </div>
      </header>
      <h1 v-if="!isLevante">{{ $t('pageSignIn.welcome') }}</h1>
      <section class="signin-options">
        <section class="signin-option-container signin-option-userpass">
          <h4 class="signin-option-title">{{ $t('pageSignIn.login') }}</h4>
          <div id="languageSelect" class="m-4 flex justify-content-center">
            <LanguageSelector />
          </div>
          <SignIn :invalid="incorrect" @submit="authWithEmail" />
        </section>
        <section class="flex flex-row align-content-center">
          <h4 class="flex m-0 align-content-center justify-content-center mr-3 flex-wrap-reverse">
            {{ $t('pageSignIn.loginWith') }}
          </h4>
          <div class="flex">
            <PvButton
              label="Test Open Modal"
              class="flex surface-0 p-1 mr-1 border-black-alpha-10 w-full text-center justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 3rem"
              @click="warningModalOpen = true"
            >
              <img src="../assets/provider-google-logo.svg" alt="The Google Logo" class="flex mr-2 w-2" />
              <span>Test Open Modal</span>
            </PvButton>
            <PvButton
              label="Sign in with Google"
              class="flex surface-0 p-1 mr-1 border-black-alpha-10 w-full text-center justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 3rem"
              @click="authWithGoogle"
            >
              <img src="../assets/provider-google-logo.svg" alt="The Google Logo" class="flex mr-2 w-2" />
              <span>Google</span>
            </PvButton>
            <PvButton
              v-if="!isLevante"
              class="flex surface-0 p-1 mr-1 border-black-alpha-10 w-full justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 3rem"
              @click="authWithClever"
            >
              <img src="../assets/provider-clever-logo.svg" alt="The Clever Logo" class="flex mr-2 w-2" />
              <span>Clever</span>
            </PvButton>
            <PvButton
              v-if="!isLevante"
              class="flex surface-0 p-1 mr-1 border-black-alpha-10 w-full justify-content-center hover:border-primary hover:surface-ground"
              style="border-radius: 3rem; height: 3rem"
              @click="authWithClassLink"
            >
              <img src="../assets/provider-classlink-logo.png" alt="The ClassLink Logo" class="flex mr-2 w-2" />
              <span>ClassLink</span>
            </PvButton>
          </div>
        </section>
        <!-- <section class="signin-option-container signin-option-providers">
          <div class="flex flex-row justify-content-center w-full">
            <p class="signin-option-title text-sm">Don't have an account yet?</p>
            <PvButton label="Register" class="signin-button w-3" @click="router.push({ name: 'Register' })" />
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
      This email is already associated with an account on this platform. Please login using your existing credentials,
      then you will be able to add this login method to your account.
    </template>
    <template #footer>
      <PvButton
        tabindex="0"
        class="border-none border-round bg-white text-primary p-2 hover:surface-200"
        text
        label="Back to Sign In"
        outlined
        @click="handleWarningModalClose"
      ></PvButton>
    </template>
  </RoarModal>
</template>

<script setup>
import { onMounted, ref, toRaw, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import SignIn from '@/components/auth/SignIn.vue';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import { useAuthStore } from '@/store/auth';
import { isMobileBrowser } from '@/helpers';
import { fetchDocById } from '../helpers/query/utils';
import RoarModal from '../components/modals/RoarModal.vue';

const incorrect = ref(false);
const isLevante = import.meta.env.MODE === 'LEVANTE';
const authStore = useAuthStore();
const router = useRouter();

const { spinner, authFromClever, authFromClassLink, routeToProfile } = storeToRefs(authStore);
const warningModalOpen = ref(false);

authStore.$subscribe(() => {
  if (authStore.uid) {
    if (authStore.userData && isLevante) {
      if (
        toRaw(authStore.userData?.userType?.toLowerCase()) === 'parent' ||
        toRaw(authStore.userData?.userType?.toLowerCase()) === 'teacher'
      ) {
        router.push({ name: 'Survey' });
        return;
      }
    }

    if (authFromClever.value) {
      router.push({ name: 'CleverLanding' });
    } else if (authFromClassLink.value) {
      router.push({ name: 'ClassLinkLanding' });
    } else if (routeToProfile.value) {
      router.push({ path: '/profile/accounts' });
    } else {
      router.push({ name: 'Home' });
    }
  }
});

const authWithGoogle = () => {
  if (isMobileBrowser()) {
    authStore.signInWithGoogleRedirect();
  } else {
    // authStore.signInWithGoogleRedirect();
    authStore
      .signInWithGooglePopup()
      .then(async () => {
        if (authStore.uid) {
          const userData = await fetchDocById('users', authStore.uid);
          const userClaims = await fetchDocById('userClaims', authStore.uid);
          authStore.userData = userData;
          authStore.userClaims = userClaims;
        }
      })
      .catch((e) => {
        const errorCode = e.code;
        if (errorCode === 'auth/email-already-in-use') {
          // User tried to register with an email that is already linked to a firebase account.
          warningModalOpen.value = true;
          spinner.value = false;
        } else {
          console.log('caught error', e);
          spinner.value = false;
        }
      });

    spinner.value = true;
  }
};

const authWithClever = () => {
  console.log('---> authWithClever');
  if (isMobileBrowser()) {
    authStore.signInWithCleverRedirect();
    spinner.value = true;
  } else {
    authStore.signInWithCleverRedirect();
    // authStore.signInWithCleverPopup();
    spinner.value = true;
  }
};

const authWithClassLink = () => {
  console.log('---> authWithClassLink');
  if (isMobileBrowser()) {
    authStore.signInWithClassLinkRedirect();
    spinner.value = true;
  } else {
    authStore.signInWithClassLinkRedirect();
    // authStore.signInWithCleverPopup();
    spinner.value = true;
  }
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
          const userData = await fetchDocById('users', authStore.uid);
          const userClaims = await fetchDocById('userClaims', authStore.uid);
          authStore.userData = userData;
          authStore.userClaims = userClaims;
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
</style>
