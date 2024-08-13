import { defineStore, acceptHMRUpdate } from 'pinia';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'vue-router';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { initNewFirekit } from '../firebaseInit';
import { useGameStore } from '@/store/game';

export const useAuthStore = () => {
  return defineStore('authStore', {
    // id is required so that Pinia can connect the store to the devtools
    id: 'authStore',
    state: () => {
      return {
        spinner: false,
        consentSpinner: false,
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
        authFromClever: false,
        authFromClassLink: false,
        userQueryKeyIndex: 0,
        assignmentQueryKeyIndex: 0,
        administrationQueryKeyIndex: 0,
        tasksDictionary: {},
      };
    },
    getters: {
      uid: (state) => {
        return state.firebaseUser.adminFirebaseUser?.uid;
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
      async completeAssessment(adminId, taskId) {
        await this.roarfirekit.completeAssessment(adminId, taskId);
        this.assignmentQueryKeyIndex += 1;
      },
      setUser() {
        onAuthStateChanged(this.roarfirekit?.admin.auth, async (user) => {
          if (user) {
            this.localFirekitInit = true;
            this.firebaseUser.adminFirebaseUser = user;
          } else {
            this.firebaseUser.adminFirebaseUser = null;
          }
        });
        onAuthStateChanged(this.roarfirekit?.app.auth, async (user) => {
          if (user) {
            this.firebaseUser.appFirebaseUser = user;
            this.updateTasksDictionary();
          } else {
            this.firebaseUser.appFirebaseUser = null;
          }
        });
      },
      async initFirekit() {
        this.roarfirekit = await initNewFirekit().then((firekit) => {
          return firekit;
        });
      },
      async getLegalDoc(docName) {
        return await this.roarfirekit.getLegalDoc(docName);
      },
      async updateTasksDictionary() {
        if (this.isFirekitInit) {
          const tasksDictionary = await this.roarfirekit.getTasksDictionary();
          this.tasksDictionary = tasksDictionary;
          return;
        }
        return;
      },
      async updateConsentStatus(docName, consentVersion, params = {}) {
        this.roarfirekit.updateConsentStatus(docName, consentVersion, params);
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
          return this.roarfirekit.signInWithPopup('google');
        }
      },
      async signInWithCleverPopup() {
        this.authFromClever = true;
        if (this.isFirekitInit) {
          return this.roarfirekit.signInWithPopup('clever');
        }
      },
      async signInWithClassLinkPopup() {
        this.authFromClasslink = true;
        if (this.isFirekitInit) {
          return this.roarfirekit.signInWithPopup('classlink');
        }
      },
      async signInWithGoogleRedirect() {
        return this.roarfirekit.initiateRedirect('google');
      },
      async signInWithCleverRedirect() {
        this.authFromClever = true;
        return this.roarfirekit.initiateRedirect('clever');
      },
      async signInWithClassLinkRedirect() {
        this.authFromClassLink = true;
        return this.roarfirekit.initiateRedirect('classlink');
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
      refreshQueryKeys() {
        this.userQueryKeyIndex += 1;
        this.assignmentQueryKeyIndex += 1;
        this.administrationQueryKeyIndex += 1;
      },
      async signOut() {
        if (this.isAuthenticated && this.isFirekitInit) {
          return this.roarfirekit.signOut().then(() => {
            this.adminOrgs = null;
            this.authFromClever = false;
            this.authFromClassLink = false;
            this.firebaseUser = {
              adminFirebaseUser: null,
              appFirebaseUser: null,
            };
            this.spinner = false;
            this.userClaims = null;
            this.userData = null;

            this.userQueryKeyIndex += 1;
            this.assignmentQueryKeyIndex += 1;
            this.administrationQueryKeyIndex += 1;
            this.tasksDictionary = {};

            const gameStore = useGameStore();
            gameStore.selectedAdmin = undefined;
          });
        } else {
          console.log('Cant log out while not logged in');
        }
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
      async createNewFamily(careTakerEmail, careTakerPassword, careTakerData, students, isTestData = false) {
        return this.roarfirekit.createNewFamily(careTakerEmail, careTakerPassword, careTakerData, students, isTestData);
      },

      // ------------------ LEVANTE ------------------
      async createLevanteUsers(userData) {
        return this.roarfirekit.createLevanteUsersWithEmailPassword(userData);
      },
    },
    // persist: true
    persist: {
      storage: sessionStorage,
      debug: false,
    },
  })();
};

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
