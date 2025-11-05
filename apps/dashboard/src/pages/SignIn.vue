<template>
  <div v-if="spinner.value" class="loading-blur">
    <AppSpinner />
  </div>

  <div id="signin-container" class="bg-gray-50">
    <div class="signin-column">
      <SignInCard class="signin-card">
        <section id="signin" class="m-0 p-0">
          <!-- Logo / header -->
          <header class="mb-0 pb-0">
            <div class="signin-logo">
              <ROARLogoShort />
            </div>
          </header>

          <!-- Render title + subtitle -->
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
import { onMounted, ref, toRaw, onBeforeUnmount, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { setUser } from '@sentry/vue';
import { useAuthStore } from '@/store/auth';
import { isMobileBrowser } from '@/helpers';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import { fetchDocById } from '@/helpers/query/utils';
import { AUTH_SSO_PROVIDERS, TERMS_OF_SERVICE_DOCUMENT_PATH } from '@/constants/auth';
import { APP_ROUTES } from '@/constants/routes';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';
import AppSpinner from '@/components/AppSpinner.vue';
import SignInForm from '@/containers/SignIn/SignIn.vue';
import { SignInCard, SignInHeader } from '@/containers/SignIn/components';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const { spinner, ssoProvider, roarfirekit } = storeToRefs(authStore);
const incorrect = ref(false);
const hideProviders = ref(false);
const emailLinkSent = ref(false);
const email = ref('');
const modalPassword = ref('');
const availableProviders = ref([]);
const hasCheckedProviders = ref(false);
const multipleProviders = ref(false);
const showPasswordField = ref(false);

function onEmailUpdate(val) {
  email.value = String(val || '').trim();
}
function onPasswordUpdate(val) {
  modalPassword.value = String(val || '');
}

const isUsername = computed(() => {
  const val = email.value ?? '';
  return val !== '' && !val.includes('@');
});

const showGenericProviders = computed(() => false);
const showScopedProviders = computed(() => !showPasswordField.value && !emailLinkSent.value);

/**
 * Redirect user after login
 */
authStore.$subscribe(() => {
  if (authStore.uid) {
    if (ssoProvider.value) {
      router.push({ path: APP_ROUTES.SSO });
    } else {
      router.push({ path: redirectSignInPath(route) });
    }
  }
});

async function getUserClaims() {
  if (authStore.uid) {
    const userClaims = await fetchDocById('userClaims', authStore.uid);
    authStore.userClaims = userClaims;
  }
  if (authStore.roarUid) {
    const userData = await fetchDocById('users', authStore.roarUid);
    authStore.userData = userData;
    setUser({ id: authStore.roarUid, userType: userData.userType });
  }
}

/**
 * AUTH FLOWS
 */
function sendMagicLink(userEmail) {
  authStore.initiateLoginWithEmailLink({ email: userEmail }).then(() => {
    emailLinkSent.value = true;
  });
}

function handleForgotPasswordWrapper() {
  roarfirekit.value.sendPasswordResetEmail(email.value);
}

function handleBackToPassword() {
  emailLinkSent.value = false;
  showPasswordField.value = true;
}

function authWithClever() {
  if (process.env.NODE_ENV === 'development' && !window.Cypress) {
    authStore.signInWithCleverPopup().then(async () => {
      await getUserClaims();
    });
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
    authStore.signInWithNYCPSPopup().then(async () => {
      await getUserClaims();
    });
  } else {
    authStore.signInWithNYCPSRedirect();
  }
  spinner.value = true;
}

function authWithGoogle() {
  if (isMobileBrowser()) {
    authStore.signInWithGoogleRedirect();
  } else {
    authStore
      .signInWithGooglePopup()
      .then(async () => {
        await getUserClaims();
      })
      .catch((e) => {
        const errorCode = e.code;
        if (errorCode === 'auth/email-already-in-use') {
          spinner.value = false;
        } else {
          spinner.value = false;
        }
      });

    spinner.value = true;
  }
}

function authWithEmailWrapper() {
  incorrect.value = false;
  let creds = toRaw({
    email: email.value,
    password: modalPassword.value,
  });

  // username path => convert to internal email
  if (!creds.email.includes('@')) {
    creds.email = `${creds.email}@roar-auth.com`;
  }

  authStore
    .logInWithEmailAndPassword(creds)
    .then(async () => {
      await getUserClaims();
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

/**
 * Provider discovery
 */
async function normalizeProviders(ids = []) {
  const out = new Set();
  for (const id of ids) {
    const lower = String(id).toLowerCase();
    if (lower === 'password' || lower === 'emaillink') out.add('password');

    if (lower === 'google.com' || lower === 'google' || lower === AUTH_SSO_PROVIDERS.GOOGLE) {
      out.add(AUTH_SSO_PROVIDERS.GOOGLE);
    }
    if (lower.startsWith('oidc.') && lower.includes('clever')) out.add(AUTH_SSO_PROVIDERS.CLEVER);
    if (lower.startsWith('oidc.') && lower.includes('classlink')) out.add(AUTH_SSO_PROVIDERS.CLASSLINK);
    if (lower.startsWith('oidc.') && lower.includes('nycps')) out.add(AUTH_SSO_PROVIDERS.NYCPS);
  }
  return [...out];
}

async function getProviders() {
  const authKit = roarfirekit.value;
  if (!authKit) {
    return [];
  }
  const emailProvider = (email.value || '').trim().toLowerCase();
  const raw = await authKit.fetchEmailAuthMethods(emailProvider);
  availableProviders.value = await normalizeProviders(raw || []);
  hasCheckedProviders.value = true;
}

async function checkAvailableProviders(triggeredEmail) {
  // set email first
  onEmailUpdate(triggeredEmail);
  // username path
  if (isUsername.value) {
    showPasswordField.value = true;
    availableProviders.value = ['password'];
    hideProviders.value = true;
    return;
  }

  await getProviders(email.value);

  // Check for multiple SSO providers
  const ssoProviders = availableProviders.value.filter((p) => ['google', 'clever', 'classlink', 'nycps'].includes(p));
  multipleProviders.value = ssoProviders.length > 1;

  if (multipleProviders.value) {
    // user must choose
    hideProviders.value = false;
    showPasswordField.value = false;
    return;
  }

  // Single provider? Just do it.
  if (availableProviders.value.includes('google')) authWithGoogle();
  if (availableProviders.value.includes('clever')) authWithClever();
  if (availableProviders.value.includes('classlink')) authWithClassLink();
  if (availableProviders.value.includes('nycps')) authWithNYCPS();

  // fallback to password / magic link
  showPasswordField.value =
    availableProviders.value.includes('password') ||
    availableProviders.value.includes('link') ||
    availableProviders.value.length === 0;

  hideProviders.value = true;
}

/**
 * Reset UI back to the "enter email" state
 */
function resetSignInUI() {
  email.value = '';
  modalPassword.value = '';
  incorrect.value = false;
  hideProviders.value = false;
  showPasswordField.value = false;
  availableProviders.value = [];
  hasCheckedProviders.value = false;
  spinner.value = false;
  multipleProviders.value = false;
  emailLinkSent.value = false;
}

/**
 * Lifecycle
 */
onMounted(() => {
  document.body.classList.add('page-signin');
});

onBeforeUnmount(() => {
  document.body.classList.remove('page-signin');
});
</script>
