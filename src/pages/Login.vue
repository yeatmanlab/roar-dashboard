<template>
  <div v-if="spinner" class="spinner-wrapper">
    <AppSpinner />
  </div>

  <div v-if="isParticipantMode" class="language-selector-wrapper">
    <LanguageSelector />
  </div>

  <div :class="`login login--${mode}`">
    <img src="/levante-icon-black.svg" alt="Levante" class="levante-icon-black" />

    <div class="login-card">
      <div class="logo-wrapper">
        <img src="/LEVANTE/Levante_Logo.png" alt="Levante" class="logo" />
        <div :class="`login-mode login-mode--${mode}`">
          {{ mode === MODES.participant ? $t('participant') : 'Researcher' }}
        </div>
      </div>

      <div v-if="isParticipantMode" class="m-0 mt-4 font-semibold text-xl text-color text-center">
        {{ $t('pageSignIn.login') }}
      </div>
      <div v-else class="m-0 mt-4 font-semibold text-xl text-color text-center">Log in to access your dashboard</div>

      <PvMessage
        v-for="msg of messages"
        :key="msg?.id"
        :severity="msg?.severity"
        class="mt-4"
        closable
        icon="pi pi-times-circle"
      >
        {{ msg?.content }}
      </PvMessage>

      <form class="form" @submit.prevent="authWithEmailOrUsername">
        <div class="flex flex-column gap-1">
          <PvInputText
            :id="$t('authSignIn.emailId')"
            v-model="v$.email.$model"
            :placeholder="isParticipantMode ? $t('authSignIn.emailPlaceholder') : 'Username or email'"
            aria-describedby="email-error"
            class="w-full"
            data-cy="input-username-email"
            @blur="isCapsLockOn = false"
            @keydown="checkForCapsLock"
            @keyup="checkForCapsLock"
          />
          <div v-for="error in v$.email.$errors" :key="error.$uid" class="text-sm p-error font-medium">
            {{ error.$message }}
          </div>
        </div>

        <div class="flex flex-column gap-1">
          <PvPassword
            :id="$t('authSignIn.passwordId')"
            v-model="v$.password.$model"
            :disabled="isSigningInWithEmailLink"
            :feedback="false"
            :placeholder="isParticipantMode ? $t('authSignIn.passwordPlaceholder') : 'Password'"
            class="w-full"
            data-cy="input-password"
            hide-icon="pi pi-eye"
            show-icon="pi pi-eye-slash"
            toggle-mask
            @blur="isCapsLockOn = false"
            @keydown="checkForCapsLock"
            @keyup="checkForCapsLock"
          />
          <div v-for="error in v$.password.$errors" :key="error.$uid" class="text-sm p-error font-medium">
            {{ error.$message }}
          </div>
        </div>

        <div v-if="isCapsLockOn" class="text-center p-error font-medium">⇪ {{ $t('capsLockIsOn') }}</div>

        <div v-if="!isParticipantMode" class="flex justify-content-between">
          <small
            v-if="isSigningInWithEmailLink"
            class="sign-in-with-email-link"
            data-cy="sign-in-with-email-link"
            @click="isSigningInWithEmailLink = false"
          >
            Sign in with email and password
          </small>
          <small
            v-else
            class="sign-in-with-email-link"
            data-cy="sign-in-with-email-link"
            @click="isSigningInWithEmailLink = true"
          >
            Sign in with email link
          </small>
          <small class="forgot-password-link" data-cy="sign-in-with-password" @click="isOpenForgotPasswordModal = true">
            Forgot your password?
          </small>
        </div>

        <PvButton
          v-if="isParticipantMode"
          :disabled="spinner"
          class="submit-btn"
          data-cy="submit-sign-in-with-password"
          type="submit"
        >
          {{ $t('authSignIn.buttonLabel') + ' &rarr;' }}
        </PvButton>
        <PvButton v-else class="submit-btn" data-cy="submit-sign-in-with-password" type="submit">Continue</PvButton>
      </form>

      <div v-if="!isParticipantMode && googleSignInErrorKey" class="font-medium text-sm p-error text-center mt-2">
        {{ $t(googleSignInErrorKey) }}
      </div>

      <div v-if="isParticipantMode" class="flex justify-content-center gap-1 mt-5">
        <div class="text-color-secondary text-center">{{ $t('pageSignIn.participantHelpMessage') }}</div>
      </div>
      <div v-else class="flex flex-column align-items-center">
        <div class="flex justify-content-between align-items-center w-full mt-3">
          <div class="flex gap-1 text-sm">
            <div class="text-color-secondary">Not sure how to login?</div>
            <a
              href="https://researcher.levante-network.org/dashboard"
              target="_blank"
              class="font-medium text-color no-underline hover:underline"
            >
              Read sign in docs
            </a>
          </div>

          <a href="https://levante-support.freshdesk.com/support/tickets/new" target="_blank" class="help-link">
            <i class="pi pi-info-circle" /> Help
          </a>
        </div>

        <div class="divider">or</div>

        <span class="mt-2 text-sm text-color hover:underline cursor-pointer" @click="authWithGoogle">
          Stanford DCC Sign in
        </span>
      </div>
    </div>

    <div class="flex align-items-center gap-3 mt-5">
      <div v-if="isParticipantMode" class="uppercase font-medium text-xs text-white opacity-70">
        {{ $t('pageSignIn.areYouAResearcher') }}
      </div>
      <div v-else class="uppercase font-medium text-xs text-white opacity-70">Are you not a researcher?</div>

      <PvButton v-if="isParticipantMode" :class="`change-mode-btn change-mode-btn--${mode}`" @click="changeMode">
        {{ $t('pageSignIn.researcherLoginBtn') }}
      </PvButton>
      <PvButton v-else :class="`change-mode-btn change-mode-btn--${mode}`" @click="changeMode">
        Participant Login
      </PvButton>
    </div>

    <footer class="login-footer">
      <a href="/privacy-page" :class="`login-footer-link login-footer-link--${mode}`">Privacy Policy</a>
    </footer>
  </div>

  <RoarModal
    :is-enabled="isOpenForgotPasswordModal"
    small
    subtitle="Enter your email to reset your password"
    title="Forgot Password"
    @modal-closed="isOpenForgotPasswordModal = false"
  >
    <template #default>
      <div class="flex flex-column">
        <label>Email</label>
        <PvInputText v-model="forgotEmail" />
      </div>
    </template>

    <template #footer>
      <PvButton tabindex="0" text label="Cancel" @click="closeForgotPasswordModal" />

      <PvButton
        tabindex="0"
        label="Send Reset Email"
        :disabled="forgotEmail?.length <= 0"
        @click="sendResetPasswordEmail"
      />
    </template>
  </RoarModal>
</template>

<script setup lang="ts">
import AppSpinner from '@/components/AppSpinner.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';
import RoarModal from '@/components/modals/RoarModal.vue';
import { APP_ROUTES } from '@/constants/routes';
import { isEmailValid, isMobileBrowser } from '@/helpers';
import { sortAssignmentsByDateOpened } from '@/helpers/assignments';
import { getUserAssignments } from '@/helpers/query/assignments';
import { fetchDocById } from '@/helpers/query/utils';
import { useAssignmentsStore } from '@/store/assignments';
import { useAuthStore, UserClaims, UserData } from '@/store/auth';
import useVuelidate from '@vuelidate/core';
import { helpers, required, requiredUnless } from '@vuelidate/validators';
import { storeToRefs } from 'pinia';
import PvButton from 'primevue/button';
import PvInputText from 'primevue/inputtext';
import PvMessage from 'primevue/message';
import PvPassword from 'primevue/password';
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

const MODES = {
  participant: 'participant',
  researcher: 'researcher',
} as const;

type Mode = (typeof MODES)[keyof typeof MODES];

type Message = {
  id: string;
  severity: string;
  content: string;
};

const assignmentsStore = useAssignmentsStore();
const authStore = useAuthStore();
const router = useRouter();

const { setUserAssignments } = assignmentsStore;
const { roarfirekit, routeToProfile, spinner, ssoProvider, userClaims } = storeToRefs(authStore);
const {
  $subscribe,
  getUserId,
  initiateLoginWithEmailLink,
  isUserAdmin,
  isUserSuperAdmin,
  logInWithEmailAndPassword,
  setUserClaims,
  setUserData,
  signInWithGooglePopup,
  signInWithGoogleRedirect,
} = authStore;

$subscribe(() => {
  if (getUserId()) {
    if (ssoProvider.value) {
      router.push({ path: APP_ROUTES.SSO });
    } else if (routeToProfile.value) {
      router.push({ path: APP_ROUTES.ACCOUNT_PROFILE });
    } else {
      router.push({ path: APP_ROUTES.HOME });
    }
  }
});

const forgotEmail = ref('');
const googleSignInErrorKey = ref('');
const isCapsLockOn = ref(false);
const isOpenForgotPasswordModal = ref(false);
const isOpenWarningModal = ref(false);
const isSigningInWithEmailLink = ref(false);
const messages = ref<Array<Message>>([]);
const mode = ref<Mode>(MODES.participant);

const isParticipantMode = computed(() => mode.value === MODES.participant);

const formState = reactive({
  email: '',
  password: '',
});

const formRules = {
  email: { required: helpers.withMessage('Username/email is required', required) },
  password: {
    required: helpers.withMessage(
      'Password is required',
      requiredUnless(() => isSigningInWithEmailLink.value),
    ),
  },
};

const v$ = useVuelidate(formRules, formState);

const authWithEmailOrUsername = async () => {
  spinner.value = true;
  googleSignInErrorKey.value = '';
  messages.value = [];

  const isValid = await v$.value.$validate();
  if (!isValid) {
    spinner.value = false;
    return;
  }

  let { email, password } = formState;

  if (!email.includes('@')) {
    email = `${email}@levante.com`;
  }

  if (isSigningInWithEmailLink.value) {
    return initiateLoginWithEmailLink({ email }).then(() => {
      router.push({ name: 'AuthEmailSent' });
    });
  }

  logInWithEmailAndPassword({ email, password })
    .then(async () => {
      await getAuthUserClaims();
      await getAuthUserData();

      if (!isUserAdmin() && !isUserSuperAdmin()) {
        await getAuthUserAssignments();
      }
    })
    .catch((e) => {
      const errorCodes = ['auth/invalid-email', 'auth/user-not-found', 'auth/wrong-password'];
      if (errorCodes.includes(e.code)) {
        messages.value.push({
          id: e.code,
          severity: 'error',
          content: 'Incorrect username/email or password',
        });
      }
      throw e;
    })
    .finally(() => {
      spinner.value = false;
    });
};

const authWithGoogle = async () => {
  if (isMobileBrowser()) return signInWithGoogleRedirect();

  spinner.value = true;
  googleSignInErrorKey.value = '';
  messages.value = [];

  signInWithGooglePopup()
    .then(async () => {
      await getAuthUserClaims();
      await getAuthUserData();

      if (!isUserAdmin() && !isUserSuperAdmin()) {
        await getAuthUserAssignments();
      }
    })
    .catch((e) => {
      console.log('ERROR', e);
      const errorCode = e?.code;

      if (errorCode === 'auth/email-already-in-use') {
        isOpenWarningModal.value = true;
        spinner.value = false;
        return;
      }

      if (!userClaims.value) {
        googleSignInErrorKey.value = 'pageSignIn.googleSignInUserNotFound';
      } else {
        googleSignInErrorKey.value = 'pageSignIn.googleSignInGenericError';
      }

      console.error('Google sign-in error', e);
    })
    .finally(() => {
      spinner.value = false;
    });
};

const getAuthUserAssignments = async () => {
  try {
    const userAssignments = await getUserAssignments(getUserId());
    const sortedAssignments = sortAssignmentsByDateOpened(userAssignments);
    setUserAssignments(sortedAssignments);
  } catch (error) {
    console.error('Failed to get user assignments', error);
  }
};

const getAuthUserClaims = async () => {
  try {
    const userClaims = await fetchDocById('userClaims', getUserId()!);
    setUserClaims(userClaims as UserClaims);
  } catch (error) {
    console.error('Failed to get user claims', error);
  }
};

const getAuthUserData = async () => {
  try {
    const userData = await fetchDocById('users', getUserId()!);
    setUserData(userData as UserData);
  } catch (error) {
    console.error('Failed to get user data', error);
  }
};

const changeMode = async (): Promise<void> => {
  v$.value.$reset();
  isSigningInWithEmailLink.value = false;
  mode.value = isParticipantMode.value ? MODES.researcher : MODES.participant;
};

const checkForCapsLock = (e: KeyboardEvent): void => {
  isCapsLockOn.value = e.getModifierState('CapsLock');
};

const closeForgotPasswordModal = () => {
  forgotEmail.value = '';
  isOpenForgotPasswordModal.value = false;
};

const sendResetPasswordEmail = () => {
  if (!isEmailValid(forgotEmail.value)) return false;
  roarfirekit.value!.sendPasswordResetEmail(forgotEmail.value);
  closeForgotPasswordModal();
};
</script>

<style scoped lang="scss">
.spinner-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: auto;
  min-height: 100dvh;
  background-color: rgba(white, 0.7);
  backdrop-filter: blur(5px);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10;
}

.language-selector-wrapper {
  display: block;
  position: absolute;
  top: 1rem;
  right: 1rem;
}

.login {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: auto;
  min-height: 100dvh;
  margin: 0;
  padding: 2rem 0;
  background-color: var(--primary-color);

  &.login--researcher {
    background-color: var(--secondary-color);
  }
}

.levante-icon-black {
  display: block;
  width: 150%;
  height: auto;
  opacity: 0.05;
  position: fixed;
  right: 25%;
  user-select: none;
  pointer-events: none;
}

.login-card {
  display: block;
  width: 100%;
  max-width: 500px;
  height: auto;
  margin: 0;
  padding: 40px 32px;
  background-color: white;
  border-radius: 8px;
  position: relative;
  box-shadow:
    rgba(0, 0, 0, 0.07) 0px 1px 2px,
    rgba(0, 0, 0, 0.07) 0px 2px 4px,
    rgba(0, 0, 0, 0.07) 0px 4px 8px,
    rgba(0, 0, 0, 0.07) 0px 8px 16px,
    rgba(0, 0, 0, 0.07) 0px 16px 32px,
    rgba(0, 0, 0, 0.07) 0px 32px 64px;
}

.logo-wrapper {
  display: block;
  width: 100%;
  max-width: 200px;
  height: auto;
  margin: 0 auto;
  padding: 0;
  position: relative;
}

.logo {
  display: block;
  width: 100%;
  height: auto;
  margin: 0;
  padding: 0;
}

.login-mode {
  display: inline-block;
  margin: 0;
  padding: 3px 5px;
  background-color: rgba(var(--bright-red-rgb), 0.1);
  border-radius: 4px;
  font-weight: 600;
  font-size: 10px;
  color: var(--primary-color);
  text-transform: uppercase;
  position: absolute;
  top: calc(100% - 14px);
  left: auto;
  right: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 2rem 0 0;
}

.sign-in-with-email-link,
.forgot-password-link {
  display: block;
  font-weight: 500;
  color: var(--text-color-secondary);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.submit-btn {
  width: 100%;
  height: auto;
  min-height: 50px;
  border-radius: 999px;
  font-weight: 600;
}

.divider {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  height: auto;
  margin: 1rem 0;
  font-weight: 500;
  font-size: 12px;
  color: var(--gray-400);
  text-transform: uppercase;
  position: relative;

  &::before,
  &::after {
    content: '';
    display: block;
    flex: 1;
    height: auto;
    border-bottom: 1px solid var(--gray-200);
  }

  &.divider--left {
    justify-content: flex-start;

    &::before {
      display: none;
    }
  }

  &.divider--right {
    justify-content: flex-end;

    &::after {
      display: none;
    }
  }
}

.google-signin-btn {
  display: inline-flex;
  width: 100%;
  height: auto;
  min-height: 50px;
  margin: 0;
  font-weight: 600;
  border-radius: 999px;
  background-color: transparent;
  border: 1px solid var(--gray-200);
  color: var(--text-color);

  &:hover {
    background-color: white !important;
    border: 1px solid var(--primary-color) !important;
    color: var(--text-color) !important;
  }
}

.google-signin-btn-logo {
  display: block;
  width: 1.5rem;
  height: auto;
  margin: 0;
}

.help-link {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 0.25rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-weight: 500;
  color: var(--text-color);
  text-decoration: none;
  transition: background-color 0.2s ease-out;

  &:hover {
    background-color: var(--gray-100);
  }
}

.change-mode-btn {
  display: inline-flex;
  margin: 0;
  padding: 0.5rem 1.5rem;
  font-weight: 600;
  border: 1px solid rgba(white, 1);
  border-radius: 999px;
  background-color: transparent;

  &:hover {
    background-color: white !important;
    border: 1px solid white !important;
    color: var(--primary-color) !important;
  }

  &.change-mode-btn--researcher {
    &:hover {
      color: var(--secondary-color) !important;
    }
  }
}

.login-footer {
  margin-top: 1rem;
  text-align: center;
}

.login-footer-link {
  background-color: white;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  text-decoration: none;
}

.login-footer-link:hover {
  text-decoration: underline;
}

.login-footer-link--participant {
  color: var(--primary-color);
}

.login-footer-link--researcher {
  color: var(--secondary-color);
}
</style>
