import { markRaw } from 'vue';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { getIdToken, onIdTokenChanged } from 'firebase/auth';
import { useRouter } from 'vue-router';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { initializeFirekit } from '@/firekit';
import { AUTH_SSO_PROVIDERS } from '@/constants/auth';
import { APP_ROUTES } from '@/constants/routes';

// Local Firebase Auth emulator mode (VITE_FIREBASE_EMULATOR_ENABLED). Inert in
// deployed builds; see logInWithEmailAndPassword for why it changes sign-in.
const isFirebaseEmulatorEnabled =
  import.meta.env.VITE_FIREBASE_EMULATOR_ENABLED === true || import.meta.env.VITE_FIREBASE_EMULATOR_ENABLED === 'true';

export const useAuthStore = () => {
  return defineStore('authStore', {
    id: 'authStore',
    state: () => {
      return {
        spinner: false,
        firebaseUser: {
          adminFirebaseUser: null,
          appFirebaseUser: null,
        },
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
        adminAuthStateListener: null,
        appAuthStateListener: null,
        accessToken: null,
        redirectError: null, // Stores SSO redirect errors for display on sign-in page
      };
    },
    getters: {
      uid: (state) => {
        return state.firebaseUser.adminFirebaseUser?.uid;
      },
      roarUid: (state) => {
        return state.userClaims?.claims?.roarUid;
      },
      email: (state) => {
        return state.firebaseUser.adminFirebaseUser?.email;
      },
      isUserAuthedAdmin: (state) => {
        return Boolean(state.firebaseUser.adminFirebaseUser);
      },
      isUserAuthedApp: (state) => {
        return Boolean(state.firebaseUser.appFirebaseUser);
      },
      isAuthenticated: (state) => {
        return Boolean(state.firebaseUser.adminFirebaseUser) && Boolean(state.firebaseUser.appFirebaseUser);
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
      async initFirekit() {
        try {
          // IMPORTANT: Firebase/Firekit objects must be wrapped with markRaw() to prevent Vue's
          // reactivity system from deeply traversing them. These objects internally reference
          // cross-origin windows/iframes created during OAuth flows (Clever, ClassLink, etc.).
          // Without markRaw(), Vue's reactive proxy throws: "SecurityError: Failed to read a
          // named property from 'Window': Blocked a frame with origin from accessing cross-origin frame."
          // See: https://github.com/vuejs/core/issues/2282
          this.roarfirekit = markRaw(await initializeFirekit());
          this.setAuthStateListeners();
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
      setAuthStateListeners() {
        // Use onIdTokenChanged for admin auth to ensure accessToken stays current during token refreshes (~hourly)
        this.adminAuthStateListener = onIdTokenChanged(this.roarfirekit?.admin.auth, async (user) => {
          if (user) {
            this.localFirekitInit = true;
            // Firebase User objects must use markRaw() for the same reason as roarfirekit above.
            // They contain internal auth provider state that references cross-origin frames.
            this.firebaseUser.adminFirebaseUser = markRaw(user);
            this.accessToken = user.accessToken;
          } else {
            this.firebaseUser.adminFirebaseUser = null;
            this.accessToken = null;
          }
        });
        this.appAuthStateListener = onIdTokenChanged(this.roarfirekit?.app.auth, async (user) => {
          if (user) {
            this.firebaseUser.appFirebaseUser = markRaw(user);
          } else {
            this.firebaseUser.appFirebaseUser = null;
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
      async logInWithEmailAndPassword({ email, password }) {
        if (!this.isFirekitInit) return;

        // Local emulator mode: use firekit's own sign-in — its bundled Firebase SDK
        // (a different major version from the dashboard's) is what's wired to the
        // Auth emulator, so calling the dashboard's SDK on firekit's Auth instance
        // fails with network-request-failed. firekit's logIn does the password
        // sign-in (which succeeds and triggers onIdTokenChanged to set the session)
        // and then calls a `setUidClaims` Cloud Function + reads Firestore — neither
        // of which the auth-only local stack runs, so the promise rejects with
        // `internal`. Swallow that post-authentication error so the app proceeds;
        // super-admin comes from the backend /me response (see resolveUserClaims),
        // and the backend derives super-admin from the DB record (matched by uid),
        // so the token needs no custom claims. Inert in deployed builds.
        //
        // TODO(firekit-removal): once the dashboard signs in via its own Firebase
        // SDK instead of firekit, replace this whole emulator branch with a direct
        // `signInWithEmailAndPassword(<dashboard auth>, email, password)` against the
        // emulator (wire `connectAuthEmulator` into the dashboard's own Firebase
        // init rather than firekit.js). That removes both the Firebase v9/v11 split
        // — the reason a direct sign-in fails today — and the `setUidClaims` dance,
        // so no swallow is needed. This branch exists only because firekit currently
        // owns the emulator-wired Auth instance.
        if (isFirebaseEmulatorEnabled) {
          try {
            await this.roarfirekit.logInWithEmailAndPassword({ email, password });
          } catch (error) {
            // Surface genuine credential failures so the sign-in form can show
            // them: firekit re-throws the underlying error unwrapped, so a wrong
            // password rejects here with a Firebase Auth code (`auth/*`) from the
            // password sign-in step, whereas the expected post-authentication
            // failure (setUidClaims/Firestore unavailable locally) carries a
            // non-auth code. Re-throw the former; swallow only the latter.
            if (typeof error?.code === 'string' && error.code.startsWith('auth/')) {
              throw error;
            }
            console.warn(
              '[auth] emulator: ignoring firekit post-sign-in error (setUidClaims/Firestore not available locally):',
              error?.code ?? error?.message ?? error,
            );
          }
          return;
        }

        return this.roarfirekit
          .logInWithEmailAndPassword({ email, password })
          .then(() => {})
          .catch((error) => {
            console.error('Error signing in:', error);
            throw error;
          });
      },
      async initiateLoginWithEmailLink({ email }) {
        if (this.isFirekitInit) {
          const redirectUrl = `${window.location.origin}${APP_ROUTES.AUTH_EMAIL_LINK}`;
          return this.roarfirekit.initiateLoginWithEmailLink({ email, redirectUrl }).then(() => {
            window.localStorage.setItem('emailForSignIn', email);
          });
        }
      },
      async signInWithEmailLink({ email, emailLink }) {
        if (this.isFirekitInit) {
          return this.roarfirekit.signInWithEmailLink({ email, emailLink }).then(() => {
            window.localStorage.removeItem('emailForSignIn');
          });
        }
      },
      async signInWithGooglePopup() {
        this.ssoProvider = AUTH_SSO_PROVIDERS.GOOGLE;
        if (this.isFirekitInit) {
          return this.roarfirekit.signInWithPopup(AUTH_SSO_PROVIDERS.GOOGLE);
        }
      },
      async signInWithGoogleRedirect() {
        this.ssoProvider = AUTH_SSO_PROVIDERS.GOOGLE;
        return this.roarfirekit.initiateRedirect(AUTH_SSO_PROVIDERS.GOOGLE);
      },
      async signInWithCleverPopup() {
        this.ssoProvider = AUTH_SSO_PROVIDERS.CLEVER;
        if (this.isFirekitInit) {
          return this.roarfirekit.signInWithPopup(AUTH_SSO_PROVIDERS.CLEVER);
        }
      },
      async signInWithCleverRedirect() {
        this.ssoProvider = AUTH_SSO_PROVIDERS.CLEVER;
        return this.roarfirekit.initiateRedirect(AUTH_SSO_PROVIDERS.CLEVER);
      },
      async signInWithClassLinkPopup() {
        this.ssoProvider = AUTH_SSO_PROVIDERS.CLASSLINK;
        if (this.isFirekitInit) {
          return this.roarfirekit.signInWithPopup(AUTH_SSO_PROVIDERS.CLASSLINK);
        }
      },
      async signInWithClassLinkRedirect() {
        this.ssoProvider = AUTH_SSO_PROVIDERS.CLASSLINK;
        return this.roarfirekit.initiateRedirect(AUTH_SSO_PROVIDERS.CLASSLINK);
      },
      async signInWithNYCPSPopup() {
        this.ssoProvider = AUTH_SSO_PROVIDERS.NYCPS;
        if (this.isFirekitInit) {
          return this.roarfirekit.signInWithPopup(AUTH_SSO_PROVIDERS.NYCPS);
        }
      },
      async signInWithNYCPSRedirect() {
        this.ssoProvider = AUTH_SSO_PROVIDERS.NYCPS;
        return this.roarfirekit.initiateRedirect(AUTH_SSO_PROVIDERS.NYCPS);
      },
      async initStateFromRedirect() {
        this.spinner = true;
        this.redirectError = null; // Clear any previous redirect errors
        const enableCookiesCallback = () => {
          const router = useRouter();
          router.replace({ name: 'EnableCookies' });
        };
        if (this.isFirekitInit) {
          return await this.roarfirekit
            .signInFromRedirectResult(enableCookiesCallback)
            .then((result) => {
              // If the result is null, then no redirect operation was called.
              if (result !== null) {
                this.spinner = true;
              } else {
                this.spinner = false;
              }
            })
            .catch((error) => {
              console.error('Error processing redirect result:', error);
              // Store redirect error for display on sign-in page
              this.redirectError = error;
              this.spinner = false;
            });
        }
      },
      async forceIdTokenRefresh() {
        const adminUser = this.firebaseUser.adminFirebaseUser;
        if (!adminUser) return null;
        // Use getIdToken directly so we can capture the fresh token synchronously.
        // Relying on the onIdTokenChanged callback introduces a race condition
        // because the callback fires asynchronously after getIdToken resolves.
        const freshToken = await getIdToken(adminUser, /* forceRefresh */ true);
        this.accessToken = freshToken;
        return freshToken;
      },
      async sendMyPasswordResetEmail() {
        if (this.email) {
          return await this.roarfirekit.sendPasswordResetEmail(this.email).then(() => {
            return true;
          });
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
