import { markRaw } from 'vue';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { getIdToken } from 'firebase/auth';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { initializeFirekit } from '@/firekit';
import { APP_ROUTES } from '@/constants/routes';
import { getAuthService } from '@/services/AuthService';

export const useAuthStore = () => {
  return defineStore('authStore', {
    id: 'authStore',
    state: () => {
      return {
        spinner: false,
        firebaseUser: null,
        adminOrgs: null,
        roarfirekit: null,
        userData: null,
        userClaims: null,
        cleverOAuthRequested: false,
        classLinkOAuthRequested: false,
        nycpsOAuthRequested: false,
        routeToProfile: false,
        ssoProvider: null,
        showOptionalAssessments: false,
        authStateListener: null,
        accessToken: null,
        redirectError: null, // Stores SSO redirect errors for display on sign-in page
      };
    },
    getters: {
      uid: (state) => {
        return state.firebaseUser?.uid;
      },
      roarUid: (state) => {
        return state.userClaims?.claims?.roarUid;
      },
      email: (state) => {
        return state.firebaseUser?.email;
      },
      isAuthenticated: (state) => {
        return Boolean(state.firebaseUser);
      },
      isFirekitInit: (state) => {
        return state.roarfirekit?.initialized;
      },
      isUserAdmin: (state) => {
        if (state.userClaims?.claims?.super_admin || state.userClaims?.claims?.admin) return true;
        if (_isEmpty(_union(...Object.values(state.userClaims?.claims?.minimalAdminOrgs ?? {})))) return false;
        return true;
      },
      isUserSuperAdmin: (state) => Boolean(state.userClaims?.claims?.super_admin),
    },
    actions: {
      /**
       * Initialize the AuthService's Firebase Auth instance and set up the
       * token change listener. Called once during bootstrap, before initFirekit.
       */
      async initAuth() {
        const authService = getAuthService();
        await authService.initialize();
        this.setAuthStateListener();
      },

      async initFirekit() {
        try {
          // IMPORTANT: Firebase/Firekit objects must be wrapped with markRaw() to prevent Vue's
          // reactivity system from deeply traversing them. These objects internally reference
          // cross-origin windows/iframes created during OAuth flows (Clever, ClassLink, etc.).
          // Without markRaw(), Vue's reactive proxy throws: "SecurityError: Failed to read a
          // named property from 'Window': Blocked a frame with origin from accessing cross-origin frame."
          // See: https://github.com/vuejs/core/issues/2282
          this.roarfirekit = markRaw(await initializeFirekit());
        } catch (error) {
          // @TODO: Improve error handling, incl. redirect to error page.
          console.error('Failed to initialize Firekit:', error);
        }
      },

      async verifyParentRegistration() {
        try {
          if (this.isFirekitInit) {
            return await this.roarfirekit.verifyParentRegistration();
          }
        } catch (error) {
          console.error('Error verifying parent registration:', error);
          throw error;
        }
      },

      /**
       * Single auth state listener on the dashboard-owned Auth instance.
       * Updates firebaseUser and accessToken on sign-in, sign-out, and token refresh.
       */
      setAuthStateListener() {
        const authService = getAuthService();
        this.authStateListener = authService.onIdTokenChanged(async (user) => {
          if (user) {
            // Firebase User objects must use markRaw() to prevent Vue's reactivity
            // system from traversing internal auth provider state that references
            // cross-origin frames.
            this.firebaseUser = markRaw(user);
            this.accessToken = user.accessToken;
          } else {
            this.firebaseUser = null;
            this.accessToken = null;
          }
        });
      },

      async completeAssessment(adminId, taskId) {
        //@TODO: Move to mutation since we cannot rotate query keys anymore.
        await this.roarfirekit.completeAssessment(adminId, taskId);
      },
      async getLegalDoc(docName) {
        return await this.roarfirekit.getLegalDoc(docName);
      },
      async registerWithEmailAndPassword({ email, password, userData }) {
        return this.roarfirekit.createStudentWithEmailPassword(email, password, userData);
      },

      /**
       * Sign in with email and password via the dashboard-owned Auth instance.
       * No emulator branch needed — AuthService handles emulator wiring transparently.
       *
       * @param {{ email: string, password: string }} credentials
       */
      async logInWithEmailAndPassword({ email, password }) {
        const authService = getAuthService();
        return authService.signInWithEmailAndPassword(email, password);
      },

      /**
       * Send a magic link sign-in email.
       *
       * @param {{ email: string }} params
       */
      async initiateLoginWithEmailLink({ email }) {
        const authService = getAuthService();
        const redirectUrl = `${window.location.origin}${APP_ROUTES.AUTH_EMAIL_LINK}`;
        await authService.sendSignInLinkToEmail(email, redirectUrl);
        window.localStorage.setItem('emailForSignIn', email);
      },

      /**
       * Complete sign-in from a magic link.
       *
       * @param {{ email: string, emailLink: string }} params
       */
      async signInWithEmailLink({ email, emailLink }) {
        const authService = getAuthService();
        await authService.signInWithEmailLink(email, emailLink);
        window.localStorage.removeItem('emailForSignIn');
      },

      /**
       * Sign in with an SSO provider via popup.
       *
       * @param {'google' | 'clever' | 'classlink' | 'nycps'} providerName
       */
      async signInWithPopup(providerName) {
        this.ssoProvider = providerName;
        const authService = getAuthService();
        return authService.signInWithPopup(providerName);
      },

      /**
       * Sign in with an SSO provider via redirect.
       *
       * @param {'google' | 'clever' | 'classlink' | 'nycps'} providerName
       */
      async signInWithRedirect(providerName) {
        this.ssoProvider = providerName;
        const authService = getAuthService();
        return authService.signInWithRedirect(providerName);
      },

      /**
       * Check for a pending SSO redirect result on page load.
       */
      async initStateFromRedirect() {
        this.spinner = true;
        this.redirectError = null;
        const authService = getAuthService();
        try {
          const result = await authService.getRedirectResult();
          if (result !== null) {
            this.spinner = true;
          } else {
            this.spinner = false;
          }
        } catch (error) {
          console.error('Error processing redirect result:', error);
          this.redirectError = error;
          this.spinner = false;
        }
      },

      /**
       * Force-refresh the ID token and update the store's accessToken synchronously.
       *
       * @returns {Promise<string | null>} The fresh token, or null if not signed in.
       */
      async forceIdTokenRefresh() {
        const user = this.firebaseUser;
        if (!user) return null;
        // Use getIdToken directly so we can capture the fresh token synchronously.
        // Relying on the onIdTokenChanged callback introduces a race condition
        // because the callback fires asynchronously after getIdToken resolves.
        const freshToken = await getIdToken(user, /* forceRefresh */ true);
        this.accessToken = freshToken;
        return freshToken;
      },

      async sendMyPasswordResetEmail() {
        if (this.email) {
          const authService = getAuthService();
          await authService.sendPasswordResetEmail(this.email);
          return true;
        } else {
          console.warn('Logged in user does not have an associated email. Unable to send password reset email');
          return false;
        }
      },

      async createNewFamily(
        careTakerEmail,
        careTakerPassword,
        careTakerData,
        students,
        consentData,
        isTestData = false,
      ) {
        if (!this.roarfirekit) {
          throw new Error('roarfirekit is not initialized');
        }

        if (!Array.isArray(students)) {
          throw new Error('students parameter must be an array');
        }

        return await this.roarfirekit.createNewFamily(
          careTakerEmail,
          careTakerPassword,
          careTakerData,
          students,
          consentData,
          isTestData,
        );
      },
      async addStudentsToFamily(careTakerEmail, careTakerData, students, consentData, isTestData = false) {
        if (!this.roarfirekit) {
          throw new Error('roarfirekit is not initialized');
        }

        if (!Array.isArray(students)) {
          throw new Error('students parameter must be an array');
        }

        return await this.roarfirekit.addStudentsToFamily(
          careTakerEmail,
          careTakerData,
          students,
          consentData,
          isTestData,
        );
      },
    },
    persist: {
      storage: sessionStorage,
      debug: false,
    },
  })();
};

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
