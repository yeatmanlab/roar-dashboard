import { markRaw } from 'vue';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { getIdToken } from 'firebase/auth';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { initializeFirekit } from '@/firekit';
import { APP_ROUTES } from '@/constants/routes';
import { getAuthService } from '@/services/AuthService';
import { queryClient } from '@/queryClient';
import { ME_QUERY_KEY } from '@/constants/queryKeys';

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
      /**
       * Readiness signal for backend (REST/API) calls — the replacement for the
       * legacy `roarfirekit.restConfig?.()` gate. True once a Firebase ID token
       * has been captured (via the `onIdTokenChanged` listener), which is all the
       * backend-scoped queries need: they authenticate off the Bearer token. The
       * token is only set after firekit's admin auth is initialized, so a truthy
       * value implies the app is fully ready. Works identically in deployed and
       * emulator builds, so it also covers the emulator-only readiness fallback
       * the now-removed `isDashboardReady` helper used to provide.
       */
      isAuthReady: (state) => {
        return Boolean(state.accessToken);
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

      /**
       * Reset all cached state tied to the current identity.
       *
       * Clears the store's `userClaims` / `userData` copies and resets the
       * `/me` cache entry. `resetQueries` (not `removeQueries`) is deliberate:
       * `removeQueries` destroys the entry WITHOUT notifying mounted observers
       * (verified against @tanstack/query-core 5.x — QueryObserver has no
       * removal handler), so components would keep rendering the previous
       * user's data; `resetQueries` notifies subscribers and refetches active
       * observers. Clearing the store fields matters because
       * `authStore.userClaims` is persisted to sessionStorage and is the
       * router guard's super-admin fallback — leaving user A's
       * `super_admin: true` in place would grant user B the fallback bypass.
       */
      resetIdentity() {
        this.userClaims = null;
        this.userData = null;
        // Fire-and-forget: the reset itself is synchronous; the returned
        // promise only tracks the refetch of active observers.
        queryClient.resetQueries({ queryKey: [ME_QUERY_KEY] }).catch(() => {});
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
        // Track the previous Firebase uid across listener invocations so we
        // can tell user changes apart from token refreshes (which fire this
        // listener too, with an unchanged uid).
        let previousUid = this.firebaseUser?.uid;
        this.authStateListener = authService.onIdTokenChanged(async (user) => {
          const incomingUid = user?.uid;
          const uidChanged = incomingUid !== previousUid;
          previousUid = incomingUid;

          // Write the new identity FIRST, then reset — so the refetch that
          // `resetQueries` triggers on active observers runs with the new
          // token (or finds observers disabled on sign-out).
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

          if (uidChanged) {
            // The `/me` cache entry is uid-less. A user switch that bypasses
            // the sign-out mutation (e.g. auth-expired → SignIn → different
            // user signs in) would otherwise serve user A's cached `/me` —
            // super_admin included — to user B while the entry is still
            // fresh. Reset on any uid change (A→B switches and A→null
            // sign-outs alike); token refreshes keep the same uid and are
            // deliberately left alone.
            this.resetIdentity();
          }
        });
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
        // Starting a new sign-in clears the previous identity's caches so no
        // interleaving of the post-sign-in claims fetch and the auth listener
        // can serve the previous user's cached /me to the new one (the
        // listener race: `signIn().then(getUserClaims)` and `onIdTokenChanged`
        // are unordered microtasks).
        this.resetIdentity();
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
        // See logInWithEmailAndPassword: clear the previous identity before
        // starting a new sign-in to rule out the listener race.
        this.resetIdentity();
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
        // See logInWithEmailAndPassword: clear the previous identity before
        // starting a new sign-in to rule out the listener race.
        this.resetIdentity();
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
        // See logInWithEmailAndPassword: clear the previous identity before
        // starting a new sign-in to rule out the listener race.
        this.resetIdentity();
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
      // NOTE: `createNewFamily` has been removed. ROAR@Home parent registration
      // now runs through the typed API via
      // `containers/FamilyRegistration/composables/useFamilyRegistration.js`
      // (create family → sign in). Consent is not recorded at registration —
      // TOS is handled post-login by the `/me` gate and per-administration
      // consent by the consent gate. Sign-in and availability pre-checks remain
      // on firekit.
      //
      // TODO(firekit-removal): `addStudentsToFamily` is the next ROAR@Home
      // migration step. The API replacement is built and unit-tested
      // (`useAddFamilyChildrenMutation` + `useAddFamilyChildren` saga), but
      // wiring it into `HomeParentStudentView` needs a trustworthy backend
      // family UUID, which the Firestore-based parent dashboard doesn't yet
      // expose. Until the parent-home Firestore→API migration lands, this
      // action stays on firekit.
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
