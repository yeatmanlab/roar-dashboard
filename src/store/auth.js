import { acceptHMRUpdate, defineStore } from 'pinia';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'vue-router';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { initializeFirekit } from '../firekit';
import { AUTH_SSO_PROVIDERS } from '../constants/auth';

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
        routeToProfile: false,
        ssoProvider: null,
        showOptionalAssessments: false,
        adminAuthStateListener: null,
        appAuthStateListener: null,
        accessToken: null,
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
          this.roarfirekit = await initializeFirekit();
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
        this.adminAuthStateListener = onAuthStateChanged(this.roarfirekit?.admin.auth, async (user) => {
          if (user) {
            this.localFirekitInit = true;
            this.firebaseUser.adminFirebaseUser = user;
            this.accessToken = user.accessToken;
          } else {
            this.firebaseUser.adminFirebaseUser = null;
          }
        });
        this.appAuthStateListener = onAuthStateChanged(this.roarfirekit?.app.auth, async (user) => {
          if (user) {
            this.firebaseUser.appFirebaseUser = user;
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
        if (this.isFirekitInit) {
          return this.roarfirekit
            .logInWithEmailAndPassword({ email, password })
            .then(() => {})
            .catch((error) => {
              console.error('Error signing in:', error);
              throw error;
            });
        }
      },
      async initiateLoginWithEmailLink({ email }) {
        if (this.isFirekitInit) {
          const redirectUrl = `${window.location.origin}/auth-email-link`;
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
        if (this.isFirekitInit) {
          return this.roarfirekit.signInWithPopup(AUTH_SSO_PROVIDERS.GOOGLE);
        }
      },
      async signInWithGoogleRedirect() {
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
      async initStateFromRedirect() {
        this.spinner = true;
        const enableCookiesCallback = () => {
          const router = useRouter();
          router.replace({ name: 'EnableCookies' });
        };
        if (this.isFirekitInit) {
          return await this.roarfirekit.signInFromRedirectResult(enableCookiesCallback).then((result) => {
            // If the result is null, then no redirect operation was called.
            if (result !== null) {
              this.spinner = true;
            } else {
              this.spinner = false;
            }
          });
        }
      },
      async forceIdTokenRefresh() {
        await this.roarfirekit.forceIdTokenRefresh();
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
        return await this.roarfirekit.createNewFamily(
          careTakerEmail,
          careTakerPassword,
          careTakerData,
          students,
          consentData,
          isTestData,
        );
      },
      async verifyParentRegistration() {
        console.log('authenticated', this.isAuthenticated, this.roarfirekit.restConfig);
        const x = this.roarfirekit.verifyParentRegistration();
        console.log('calling verifyParent Registration', x);
        return await x;
      },

      // ------------------ LEVANTE ------------------
      async createLevanteUsers(userData) {
        return this.roarfirekit.createLevanteUsersWithEmailPassword(userData);
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
