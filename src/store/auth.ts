import { acceptHMRUpdate, defineStore } from 'pinia';
import { onAuthStateChanged, User, Unsubscribe } from 'firebase/auth';
import { useRouter } from 'vue-router';
import { initNewFirekit } from '../firebaseInit';
import { AUTH_SSO_PROVIDERS } from '../constants/auth';
import posthogInstance from '@/plugins/posthog';
import { logger } from '@/logger';
import { RoarFirekit } from '@levante-framework/firekit';
import { ref, type Ref } from 'vue';

interface FirebaseUser {
  adminFirebaseUser: User | null;
}

interface UserClaims {
  claims: {
    roarUid?: string;
    super_admin?: boolean;
    admin?: boolean;
    useNewPermissions?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface EmailLinkCredentials {
  email: string;
  emailLink: string;
}

interface UserData {
  roles: { siteId: string; role: string; siteName: string }[];
  [key: string]: unknown;
}

interface SiteInfo {
  siteId: string;
  siteName: string;
}

export const useAuthStore = defineStore(
  'authStore',
  () => {
    // State
    const adminAuthStateListener: Ref<Unsubscribe | null> = ref(null);
    const adminOrgs: Ref<unknown | null> = ref(null);
    const firebaseUser: Ref<FirebaseUser> = ref({ adminFirebaseUser: null });
    const roarfirekit: Ref<RoarFirekit | null> = ref(null);
    const routeToProfile: Ref<boolean> = ref(false);
    const showOptionalAssessments: Ref<boolean> = ref(false);
    const showSideBar: Ref<boolean> = ref(false);
    const spinner: Ref<boolean> = ref(false);
    const ssoProvider: Ref<string | null> = ref(null);
    const userClaims: Ref<UserClaims | null> = ref(null);
    const userData: Ref<UserData | null> = ref(null);
    const sites: Ref<SiteInfo[]> = ref([]);
    const currentSite: Ref<string | null> = ref(null);
    const shouldUsePermissions: Ref<boolean> = ref(false);

    // Reset function
    function $reset(): void {
      adminAuthStateListener.value?.();
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
      sites.value = [];
      currentSite.value = null;
      shouldUsePermissions.value = false;
    }

    // Getters
    function getUserId(): string | undefined {
      return firebaseUser.value.adminFirebaseUser?.uid;
    }

    function getUserEmail(): string | undefined {
      return firebaseUser.value.adminFirebaseUser?.email ?? undefined;
    }

    function getRoarUid(): string | undefined {
      return userClaims.value?.claims?.roarUid;
    }

    function getUid(): string | undefined {
      return firebaseUser.value.adminFirebaseUser?.uid;
    }

    function getEmail(): string | undefined {
      return firebaseUser.value.adminFirebaseUser?.email ?? undefined;
    }

    function isUserAuthedAdmin(): boolean {
      return Boolean(firebaseUser.value.adminFirebaseUser);
    }

    function isAuthenticated(): boolean {
      return Boolean(firebaseUser.value.adminFirebaseUser);
    }

    function isFirekitInit(): boolean {
      return roarfirekit.value?.initialized ?? false;
    }

    function isUserAdmin(): boolean {
      return Boolean(userClaims.value?.claims?.super_admin || userClaims.value?.claims?.admin);
    }

    function isUserSuperAdmin(): boolean {
      return Boolean(userClaims.value?.claims?.super_admin);
    }

    // Actions
    async function initFirekit(): Promise<void> {
      try {
        roarfirekit.value = await initNewFirekit();
        setAuthStateListeners();
      } catch (error) {
        // @TODO: Improve error handling as this is a critical error.
        console.error('Error initializing Firekit:', error);
      }
    }

    function setAuthStateListeners(): void {
      if (roarfirekit.value?.admin?.auth) {
        adminAuthStateListener.value = onAuthStateChanged(
          roarfirekit.value.admin.auth as any,
          async (user: User | null) => {
            if (user) {
              firebaseUser.value.adminFirebaseUser = user;
              logger.setUser({
                uid: user.uid,
                email: user.email ?? '',
              });
            } else {
              firebaseUser.value.adminFirebaseUser = null;
              logger.setUser(null);
            }
          }
        );
      }
    }

    async function completeAssessment(adminId: string, taskId: string): Promise<void> {
      await roarfirekit.value?.completeAssessment(adminId, taskId);
    }

    async function getLegalDoc(docName: string): Promise<unknown> {
      return await roarfirekit.value?.getLegalDoc(docName);
    }

    async function logInWithEmailAndPassword({ email, password }: LoginCredentials): Promise<void> {
      if (isFirekitInit()) {
        return roarfirekit.value
          ?.logInWithEmailAndPassword({ email, password })
          .then(() => {})
          .catch((error) => {
            console.error(`Error signing in: ${error}`);
            throw error;
          });
      }
    }

    async function initiateLoginWithEmailLink({ email }: Pick<LoginCredentials, 'email'>): Promise<void> {
      if (isFirekitInit()) {
        const redirectUrl = `${window.location.origin}/auth-email-link`;

        return roarfirekit.value?.initiateLoginWithEmailLink({ email, redirectUrl }).then(() => {
          window.localStorage.setItem('emailForSignIn', email);
        });
      }
    }

    async function signInWithEmailLink({ email, emailLink }: EmailLinkCredentials): Promise<void> {
      if (isFirekitInit()) {
        return roarfirekit.value?.signInWithEmailLink({ email, emailLink }).then(() => {
          window.localStorage.removeItem('emailForSignIn');
        });
      }
    }

    async function signInWithGooglePopup(): Promise<unknown> {
      if (isFirekitInit()) {
        return roarfirekit.value?.signInWithPopup(AUTH_SSO_PROVIDERS.GOOGLE as any);
      }
    }

    async function signInWithGoogleRedirect(): Promise<void> {
      return roarfirekit.value?.initiateRedirect(AUTH_SSO_PROVIDERS.GOOGLE as any);
    }

    async function initStateFromRedirect(): Promise<unknown> {
      spinner.value = true;

      const enableCookiesCallback = (): void => {
        const router = useRouter();
        router.replace({ name: 'EnableCookies' });
      };

      if (isFirekitInit()) {
        return await roarfirekit.value?.signInFromRedirectResult(enableCookiesCallback).then((result) => {
          // If the result is null, then no redirect operation was called.
          spinner.value = result != null;
        });
      }
    }

    async function forceIdTokenRefresh(): Promise<void> {
      await roarfirekit.value?.forceIdTokenRefresh();
    }

    async function sendMyPasswordResetEmail(): Promise<boolean> {
      if (getUserEmail()) {
        return (await roarfirekit.value?.sendPasswordResetEmail(getUserEmail()!).then(() => true)) ?? false;
      }

      console.warn('Logged in user does not have an associated email. Unable to send password reset email');
      return false;
    }

    async function createUsers(userData: unknown): Promise<unknown> {
      return roarfirekit.value?.createUsers(userData as any);
    }

    async function signOut(): Promise<void> {
      console.log('PostHog Reset (explicit signOut)');
      posthogInstance.reset();

      if (isFirekitInit()) {
        return roarfirekit.value?.signOut();
      }
    }

    function setUserData(data: UserData): void {
      userData.value = data;
      if (data?.roles && data.roles.length > 0) {
        sites.value = data.roles.map((role: { siteId: string; role: string; siteName: string }) => ({
          siteId: role.siteId,
          siteName: role.siteName
        }));
        currentSite.value = data.roles[0]?.siteId ?? null;
      }
    }

    function setUserClaims(claims: UserClaims | null): void {
      userClaims.value = claims;
      shouldUsePermissions.value = Boolean(claims?.claims?.useNewPermissions);
    }

    function setShowSideBar(show: boolean): void {
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
      sites,
      currentSite,
      shouldUsePermissions,

      // Getters
      getUserId,
      getUserEmail,
      getRoarUid,
      getUid,
      getEmail,
      isUserAuthedAdmin,
      isAuthenticated,
      isFirekitInit,
      isUserAdmin,
      isUserSuperAdmin,

      // Actions
      $reset,
      completeAssessment,
      createUsers,
      forceIdTokenRefresh,
      getLegalDoc,
      initFirekit,
      initiateLoginWithEmailLink,
      initStateFromRedirect,
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

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
