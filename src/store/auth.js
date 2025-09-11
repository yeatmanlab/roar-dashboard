import { defineStore } from 'pinia';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'vue-router';
import { initNewFirekit } from '../firebaseInit';
import { AUTH_SSO_PROVIDERS } from '../constants/auth';
import posthogInstance from '@/plugins/posthog';
import { logger } from '@/logger';
import { ref } from 'vue';

export const useAuthStore = defineStore(
  'authStore',
  () => {
    const adminAuthStateListener = ref(null);
    const adminOrgs = ref(null);
    const firebaseUser = ref({ adminFirebaseUser: null });
    const roarfirekit = ref(null);
    const routeToProfile = ref(false);
    const showOptionalAssessments = ref(false);
    const showSideBar = ref(false);
    const spinner = ref(false);
    const ssoProvider = ref(null);
    const userClaims = ref(null);
    const userData = ref(null);

    function $reset() {
      adminAuthStateListener.value = null;
      adminOrgs.value = null;
      firebaseUser.value = { adminFirebaseUser: null };
      roarfirekit.value = null;
      routeToProfile.value = false;
      showOptionalAssessments.value = false;
      showSideBar.value = false;
      spinner.value = false;
      ssoProvider.value = null;
      userClaims.value = null;
      userData.value = null;
    }

    function getUserId() {
      return firebaseUser.value.adminFirebaseUser?.uid;
    }

    function getUserEmail() {
      return firebaseUser.value.adminFirebaseUser?.email;
    }

    function isUserAuthedAdmin() {
      return Boolean(firebaseUser.value.adminFirebaseUser);
    }

    function isAuthenticated() {
      return Boolean(firebaseUser.value.adminFirebaseUser);
    }

    function isFirekitInit() {
      return roarfirekit.value?.initialized;
    }

    function isUserAdmin() {
      return Boolean(userClaims.value?.claims?.super_admin || userClaims.value?.claims?.admin);
    }

    function isUserSuperAdmin() {
      return Boolean(userClaims.value?.claims?.super_admin);
    }

    async function initFirekit() {
      try {
        roarfirekit.value = await initNewFirekit();
        setAuthStateListeners();
      } catch (error) {
        // @TODO: Improve error handling as this is a critical error.
        console.error('Error initializing Firekit:', error);
      }
    }

    function setAuthStateListeners() {
      adminAuthStateListener.value = onAuthStateChanged(roarfirekit.value?.admin.auth, async (user) => {
        if (user) {
          firebaseUser.value.adminFirebaseUser = user;
          logger.setUser(user);
        } else {
          firebaseUser.value.adminFirebaseUser = null;
          logger.setUser(null);
        }
      });
    }

    async function completeAssessment(adminId, taskId) {
      await roarfirekit.value.completeAssessment(adminId, taskId);
    }

    async function getLegalDoc(docName) {
      return await roarfirekit.value.getLegalDoc(docName);
    }

    async function logInWithEmailAndPassword({ email, password }) {
      if (isFirekitInit()) {
        return roarfirekit.value
          .logInWithEmailAndPassword({ email, password })
          .then(() => {})
          .catch((error) => {
            console.error(`Error signing in: ${error}`);
            throw error;
          });
      }
    }

    async function initiateLoginWithEmailLink({ email }) {
      if (isFirekitInit()) {
        const redirectUrl = `${window.location.origin}/auth-email-link`;

        return roarfirekit.value.initiateLoginWithEmailLink({ email, redirectUrl }).then(() => {
          window.localStorage.setItem('emailForSignIn', email);
        });
      }
    }

    async function signInWithEmailLink({ email, emailLink }) {
      if (isFirekitInit()) {
        return roarfirekit.value.signInWithEmailLink({ email, emailLink }).then(() => {
          window.localStorage.removeItem('emailForSignIn');
        });
      }
    }

    async function signInWithGooglePopup() {
      if (isFirekitInit()) {
        return roarfirekit.value.signInWithPopup(AUTH_SSO_PROVIDERS.GOOGLE);
      }
    }

    async function signInWithGoogleRedirect() {
      return roarfirekit.value.initiateRedirect(AUTH_SSO_PROVIDERS.GOOGLE);
    }

    async function initStateFromRedirect() {
      spinner.value = true;

      const enableCookiesCallback = () => {
        const router = useRouter();
        router.replace({ name: 'EnableCookies' });
      };

      if (isFirekitInit()) {
        return await roarfirekit.value.signInFromRedirectResult(enableCookiesCallback).then((result) => {
          // If the result is null, then no redirect operation was called.
          spinner.value = result != null;
        });
      }
    }

    async function forceIdTokenRefresh() {
      await roarfirekit.value.forceIdTokenRefresh();
    }

    async function sendMyPasswordResetEmail() {
      if (getUserEmail()) {
        return await roarfirekit.value.sendPasswordResetEmail(getUserEmail()).then(() => true);
      }

      console.warn('Logged in user does not have an associated email. Unable to send password reset email');
      return false;
    }

    async function createUsers(userData) {
      return roarfirekit.value.createUsers(userData);
    }

    async function signOut() {
      console.log('PostHog Reset (explicit signOut)');
      posthogInstance.reset();

      if (isFirekitInit()) {
        return roarfirekit.value.signOut();
      }
    }

    function setUserData(data) {
      userData.value = data;
    }

    function setUserClaims(claims) {
      userClaims.value = claims;
    }

    function setShowSideBar(show) {
      showSideBar.value = show;
    }

    return {
      // State
      adminAuthStateListener,
      adminOrgs,
      firebaseUser,
      roarfirekit,
      routeToProfile,
      showOptionalAssessments,
      showSideBar,
      spinner,
      ssoProvider,
      userClaims,
      userData,

      // Actions
      $reset,
      completeAssessment,
      createUsers,
      getUserEmail,
      forceIdTokenRefresh,
      getLegalDoc,
      initFirekit,
      initiateLoginWithEmailLink,
      initStateFromRedirect,
      isAuthenticated,
      isFirekitInit,
      isUserAdmin,
      isUserAuthedAdmin,
      isUserSuperAdmin,
      logInWithEmailAndPassword,
      sendMyPasswordResetEmail,
      setAuthStateListeners,
      setShowSideBar,
      setUserClaims,
      setUserData,
      signInWithEmailLink,
      signInWithGooglePopup,
      signInWithGoogleRedirect,
      signOut,
      getUserId,
    };
  },
  {
    persist: {
      debug: false,
      paths: ['firebaseUser', 'ssoProvider'],
      storage: sessionStorage,
    },
  },
);
