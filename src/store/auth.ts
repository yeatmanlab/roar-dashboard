import { acceptHMRUpdate, defineStore } from 'pinia';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'vue-router';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { initNewFirekit } from '../firebaseInit';
import { AUTH_SSO_PROVIDERS } from '../constants/auth';
import { Router } from 'vue-router'; // Assuming vue-router v4, adjust if needed

// Define reusable reference type
interface RefObject {
  id: string;
  abbreviation?: string;
}

// Define UserData based on previous deductions
interface UserData {
  email: string;
  dob: string;
  grade: string;
  schools: RefObject | null;
  districts: RefObject | null;
  classes: RefObject | null;
  families: RefObject | null;
  groups: RefObject | null;
  // Allow other properties potentially used elsewhere
  [key: string]: any;
}

// Placeholder types for RoarFirekit method signatures
// Define these based on the actual structure if known
interface CreateParentInput {
    name: string; // Guessed property from previous error
    legal?: any; // Guessed property from previous error
    [key: string]: any; // Add other properties as needed
}
interface ChildData {
    [key: string]: any;
}

// Define interfaces for complex types
interface FirebaseUserState {
  adminFirebaseUser: User | null;
  appFirebaseUser: User | null;
}

interface UserClaims {
  claims: {
    super_admin?: boolean;
    admin?: boolean;
    minimalAdminOrgs?: { [key: string]: any };
    roarUid?: string;
  };
}

// Define the type for the roarfirekit object based on its actual structure
// This is a placeholder, replace with the actual type if available
interface RoarFirekit {
  initialized: boolean;
  admin?: { auth: any }; // Replace 'any' with the actual type if available. Made optional.
  app?: { auth: any }; // Replace 'any' with the actual type if available. Made optional.
  completeAssessment: (adminId: string, taskId: string) => Promise<void>;
  getLegalDoc: (docName: string) => Promise<any>; // Replace 'any' with the actual type
  createStudentWithEmailPassword: (email: string, password: string, userData: any) => Promise<any>; // Using any for userData temporarily
  logInWithEmailAndPassword: (credentials: { email: string; password: string }) => Promise<any>; // Replace 'any'
  initiateLoginWithEmailLink: (params: { email: string; redirectUrl: string }) => Promise<void>;
  signInWithEmailLink: (params: { email: string; emailLink: string }) => Promise<any>; // Corrected return type again
  signInWithPopup: (provider: any) => Promise<void>;
  initiateRedirect: (provider: any, linkToAuthenticatedUser?: boolean) => Promise<never>;
  signInFromRedirectResult: (callback: () => void) => Promise<any>; // Replace 'any'
  forceIdTokenRefresh: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  createNewFamily: (caretakerEmail: string, caretakerPassword: string, caretakerUserData: CreateParentInput, children: ChildData[], consentData: { name: string; text: string; version: string; }, isTestData?: boolean) => Promise<any>; // Use imported types
  createLevanteUsersWithEmailPassword?: (userData: any) => Promise<any>; // Replace 'any' - Made optional
  createUsers: (userData: any) => Promise<any>; // Replace 'any'
}

interface AuthState {
  spinner: boolean;
  firebaseUser: FirebaseUserState;
  adminOrgs: any | null; // Replace 'any' with a more specific type if possible
  roarfirekit: any | null; // Use any for now to bypass complex type checking
  userData: UserData | null;
  userClaims: UserClaims | null;
  cleverOAuthRequested: boolean;
  classLinkOAuthRequested: boolean;
  routeToProfile: boolean;
  ssoProvider: string | null; // Assuming AUTH_SSO_PROVIDERS values are strings
  showOptionalAssessments: boolean;
  adminAuthStateListener: (() => void) | null; // Type for unsubscribe function from onAuthStateChanged
  appAuthStateListener: (() => void) | null; // Type for unsubscribe function from onAuthStateChanged
}

export const useAuthStore = defineStore('authStore', {
  state: (): AuthState => ({
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
  }),
  getters: {
    uid: (state): string | undefined => {
      return state.firebaseUser.adminFirebaseUser?.uid;
    },
    roarUid: (state): string | undefined => {
      return state.userClaims?.claims?.roarUid;
    },
    email: (state): string | null | undefined => {
      return state.firebaseUser.adminFirebaseUser?.email;
    },
    isUserAuthedAdmin: (state): boolean => {
      return Boolean(state.firebaseUser.adminFirebaseUser);
    },
    isUserAuthedApp: (state): boolean => {
      return Boolean(state.firebaseUser.appFirebaseUser);
    },
    isAuthenticated: (state): boolean => {
      return Boolean(state.firebaseUser.adminFirebaseUser) && Boolean(state.firebaseUser.appFirebaseUser);
    },
    isFirekitInit: (state): boolean => {
      return state.roarfirekit?.initialized ?? false;
    },
    isUserAdmin: (state): boolean => {
      if (state.userClaims?.claims?.super_admin || state.userClaims?.claims?.admin) return true;
      // Ensure minimalAdminOrgs is checked safely
      const orgValues = Object.values(state.userClaims?.claims?.minimalAdminOrgs ?? {});
      if (_isEmpty(orgValues)) return false;
      // Use `flat()` for modern environments or a polyfill/alternative for older ones
      // Assuming _union works similarly to lodash's union which expects arrays
      return !_isEmpty(_union(...orgValues.map(val => Array.isArray(val) ? val : [])));
    },
    isUserSuperAdmin: (state): boolean => Boolean(state.userClaims?.claims?.super_admin),
  },
  actions: {
    async initFirekit() {
      try {
        this.roarfirekit = await initNewFirekit();
        this.setAuthStateListeners();
      } catch (error: any) {
        // @TODO: Improve error handling as this is a critical error.
        console.error('Error initializing Firekit:', error);
      }
    },
    setAuthStateListeners() {
      if (this.roarfirekit?.admin?.auth) {
        this.adminAuthStateListener = onAuthStateChanged(this.roarfirekit.admin.auth, async (user: User | null) => {
          if (user) {
            // Removed `this.localFirekitInit = true;` as it's not defined in state
            this.firebaseUser.adminFirebaseUser = user;
          } else {
            this.firebaseUser.adminFirebaseUser = null;
          }
        });
      }
      if (this.roarfirekit?.app?.auth) {
        this.appAuthStateListener = onAuthStateChanged(this.roarfirekit.app.auth, async (user: User | null) => {
          if (user) {
            this.firebaseUser.appFirebaseUser = user;
          } else {
            this.firebaseUser.appFirebaseUser = null;
          }
        });
      }
    },
    async completeAssessment(adminId: string, taskId: string) {
      if (!this.roarfirekit) return; // Guard clause
      await this.roarfirekit.completeAssessment(adminId, taskId);
    },
    async getLegalDoc(docName: string): Promise<any> { // Specify return type if known
      if (!this.roarfirekit) return Promise.reject(new Error('Firekit not initialized')); // Guard clause
      return await this.roarfirekit.getLegalDoc(docName);
    },
    async registerWithEmailAndPassword({ email, password, userData }: { email: string; password: string; userData: any }): Promise<any> { // Using any for userData temporarily
      if (!this.roarfirekit) return Promise.reject(new Error('Firekit not initialized')); // Guard clause
      return this.roarfirekit.createStudentWithEmailPassword(email, password, userData);
    },
    async logInWithEmailAndPassword({ email, password }: { email: string; password: string }): Promise<void> { // Return type likely void or specific user credential type
      if (this.isFirekitInit && this.roarfirekit) {
        return this.roarfirekit
          .logInWithEmailAndPassword({ email, password })
          .then(() => { }) // Handle success case if needed
          .catch((error: any) => {
            console.error('Error signing in:', error);
            throw error; // Re-throw the error for handling upstream
          });
      } else {
         return Promise.reject(new Error('Firekit not initialized'));
      }
    },
    async initiateLoginWithEmailLink({ email }: { email: string }): Promise<void> {
      if (this.isFirekitInit && this.roarfirekit) {
        const redirectUrl = `${window.location.origin}/auth-email-link`;
        return this.roarfirekit.initiateLoginWithEmailLink({ email, redirectUrl }).then(() => {
          window.localStorage.setItem('emailForSignIn', email);
        });
      } else {
         return Promise.reject(new Error('Firekit not initialized'));
      }
    },
    async signInWithEmailLink({ email, emailLink }: { email: string; emailLink: string }): Promise<any> {
      if (this.isFirekitInit && this.roarfirekit) {
        const result = await this.roarfirekit.signInWithEmailLink({ email, emailLink });
        window.localStorage.removeItem('emailForSignIn');
        return result;
      } else {
         return Promise.reject(new Error('Firekit not initialized'));
      }
    },
    async signInWithGooglePopup(): Promise<void> {
      if (this.isFirekitInit && this.roarfirekit) {
        return this.roarfirekit.signInWithPopup(AUTH_SSO_PROVIDERS.GOOGLE);
      } else {
         return Promise.reject(new Error('Firekit not initialized'));
      }
    },
    async signInWithGoogleRedirect(): Promise<void> {
       if (!this.roarfirekit) return Promise.reject(new Error('Firekit not initialized')); // Guard clause
       await this.roarfirekit.initiateRedirect(AUTH_SSO_PROVIDERS.GOOGLE);
    },
    async signInWithCleverPopup(): Promise<void> {
      this.ssoProvider = AUTH_SSO_PROVIDERS.CLEVER;
      if (this.isFirekitInit && this.roarfirekit) {
        return this.roarfirekit.signInWithPopup(AUTH_SSO_PROVIDERS.CLEVER);
      } else {
         return Promise.reject(new Error('Firekit not initialized'));
      }
    },
    async signInWithCleverRedirect(): Promise<void> {
      this.ssoProvider = AUTH_SSO_PROVIDERS.CLEVER;
      if (!this.roarfirekit) return Promise.reject(new Error('Firekit not initialized')); // Guard clause
      await this.roarfirekit.initiateRedirect(AUTH_SSO_PROVIDERS.CLEVER);
    },
    async signInWithClassLinkPopup(): Promise<void> {
      this.ssoProvider = AUTH_SSO_PROVIDERS.CLASSLINK;
      if (this.isFirekitInit && this.roarfirekit) {
        return this.roarfirekit.signInWithPopup(AUTH_SSO_PROVIDERS.CLASSLINK);
      } else {
         return Promise.reject(new Error('Firekit not initialized'));
      }
    },
    async signInWithClassLinkRedirect(): Promise<void> {
      this.ssoProvider = AUTH_SSO_PROVIDERS.CLASSLINK;
      if (!this.roarfirekit) return Promise.reject(new Error('Firekit not initialized')); // Guard clause
      await this.roarfirekit.initiateRedirect(AUTH_SSO_PROVIDERS.CLASSLINK);
    },
    async initStateFromRedirect(): Promise<any> { // Replace 'any' with actual type if known
      this.spinner = true;
      const router: Router = useRouter(); // Get router instance inside the action
      const enableCookiesCallback = () => {
        router.replace({ name: 'EnableCookies' });
      };
      if (this.isFirekitInit && this.roarfirekit) {
        try {
           const result = await this.roarfirekit.signInFromRedirectResult(enableCookiesCallback);
            // If the result is null, then no redirect operation was called.
            if (result !== null) {
              // Assuming spinner should remain true if redirect result is processed
              this.spinner = true; 
            } else {
              this.spinner = false;
            }
            return result;
        } catch (error: any) {
           console.error('Error during redirect sign-in:', error);
           this.spinner = false; // Ensure spinner is turned off on error
           throw error; // Re-throw the error
        }
      } else {
          this.spinner = false; // Ensure spinner is turned off
          return Promise.reject(new Error('Firekit not initialized'));
      }
    },
    async forceIdTokenRefresh(): Promise<void> {
      if (!this.roarfirekit) return Promise.reject(new Error('Firekit not initialized')); // Guard clause
      await this.roarfirekit.forceIdTokenRefresh();
    },
    async sendMyPasswordResetEmail(): Promise<boolean> {
      const userEmail = this.email; // Use the getter which already handles potential nullability
      if (userEmail && this.roarfirekit) {
        try {
          await this.roarfirekit.sendPasswordResetEmail(userEmail);
          return true;
        } catch (error: any) {
          console.error('Error sending password reset email:', error);
          return false; // Indicate failure
        } 
      } else {
        console.warn('Logged in user does not have an associated email or Firekit not initialized. Unable to send password reset email');
        return false;
      }
    },
    async createNewFamily(caretakerEmail: string, caretakerPassword: string, caretakerUserData: CreateParentInput, children: ChildData[], consentData: { name: string; text: string; version: string }, isTestData: boolean = false): Promise<any> { // Use imported types
      if (!this.roarfirekit) return Promise.reject(new Error('Firekit not initialized')); // Guard clause
      return this.roarfirekit.createNewFamily(caretakerEmail, caretakerPassword, caretakerUserData, children, consentData, isTestData);
    },

    // ------------------ LEVANTE ------------------
    async createLevanteUsers(userData: any): Promise<any> { // Replace 'any' types
       if (!this.roarfirekit?.createLevanteUsersWithEmailPassword) return Promise.reject(new Error('Firekit not initialized or method missing')); // Guard clause with optional chaining check
       return this.roarfirekit.createLevanteUsersWithEmailPassword(userData);
    },
    async createUsers(userData: any): Promise<any> { // Replace 'any' types
       if (!this.roarfirekit) return Promise.reject(new Error('Firekit not initialized')); // Guard clause
       return this.roarfirekit.createUsers(userData);
    },
  },
  persist: {
    storage: sessionStorage,
    paths: [
      'firebaseUser',
      'ssoProvider',
      'cleverOAuthRequested',
      'classLinkOAuthRequested',
    ],
    debug: false,
  },
});

// HMR (Hot Module Replacement) - No type changes needed here usually
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
} 