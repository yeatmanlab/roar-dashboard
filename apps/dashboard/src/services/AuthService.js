/**
 * Dashboard-owned Firebase Auth service.
 *
 * Owns Firebase Auth initialization, sign-in/sign-out, token management, and
 * emulator wiring. This decouples the dashboard from roar-firekit's bundled
 * Firebase v9 SDK — the dashboard uses its own Firebase v11 SDK directly.
 *
 * Singleton: call `createAuthService(config)` once at bootstrap, then
 * `getAuthService()` everywhere else.
 */
import { initializeApp, getApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword as fbSignInWithEmailAndPassword,
  signInWithPopup as fbSignInWithPopup,
  signInWithRedirect as fbSignInWithRedirect,
  getRedirectResult as fbGetRedirectResult,
  signInWithEmailLink as fbSignInWithEmailLink,
  sendSignInLinkToEmail as fbSendSignInLinkToEmail,
  isSignInWithEmailLink as fbIsSignInWithEmailLink,
  createUserWithEmailAndPassword as fbCreateUserWithEmailAndPassword,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  fetchSignInMethodsForEmail as fbFetchSignInMethodsForEmail,
  getIdToken,
  onIdTokenChanged,
  signOut as fbSignOut,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';

const FIREBASE_APP_NAME = 'roar-dashboard-auth';

/**
 * Provider ID mapping. Google uses its native provider; OIDC-based SSO
 * providers (Clever, ClassLink, NYCPS) use Firebase's generic OAuthProvider
 * with a provider ID of `oidc.<name>`.
 */
const SSO_PROVIDER_MAP = Object.freeze({
  google: () => new GoogleAuthProvider(),
  clever: () => new OAuthProvider('oidc.clever'),
  classlink: () => new OAuthProvider('oidc.classlink'),
  nycps: () => new OAuthProvider('oidc.nycps'),
});

/** @type {AuthService | null} */
let instance = null;

class AuthService {
  /** @type {import('firebase/app').FirebaseApp} */
  #app;
  /** @type {import('firebase/auth').Auth} */
  #auth;
  /** @type {boolean} */
  #initialized = false;
  /** @type {{ projectId: string, apiKey: string, authDomain: string, emulatorAuthHost?: string }} */
  #config;

  /**
   * @param {{ projectId: string, apiKey: string, authDomain: string, emulatorAuthHost?: string }} config
   */
  constructor(config) {
    this.#config = config;
  }

  /**
   * Initialize the Firebase app and Auth instance.
   *
   * Connects to the Auth emulator when `config.emulatorAuthHost` is set.
   * Sets session persistence so auth state doesn't survive browser tabs.
   */
  async initialize() {
    if (this.#initialized) return;

    const isEmulator = Boolean(this.#config.emulatorAuthHost);

    if (!isEmulator) {
      const required = {
        projectId: this.#config.projectId,
        apiKey: this.#config.apiKey,
        authDomain: this.#config.authDomain,
      };
      const missing = Object.entries(required)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      if (missing.length > 0) {
        throw new Error(`[AuthService] Missing required Firebase config: ${missing.join(', ')}`);
      }
    }

    const firebaseConfig = {
      projectId: isEmulator ? 'demo-roar' : this.#config.projectId,
      apiKey: isEmulator ? 'fake-api-key' : this.#config.apiKey,
      authDomain: isEmulator ? undefined : this.#config.authDomain,
    };

    // initializeApp with a unique name to avoid collision with firekit's apps.
    try {
      this.#app = getApp(FIREBASE_APP_NAME);
    } catch {
      this.#app = initializeApp(firebaseConfig, FIREBASE_APP_NAME);
    }

    this.#auth = getAuth(this.#app);

    if (isEmulator) {
      const emulatorUrl = `http://${this.#config.emulatorAuthHost}`;
      connectAuthEmulator(this.#auth, emulatorUrl, { disableWarnings: true });
    }

    await setPersistence(this.#auth, browserSessionPersistence);
    this.#initialized = true;
  }

  /** @returns {import('firebase/auth').Auth} The Firebase Auth instance (readonly). */
  get auth() {
    return this.#auth;
  }

  /**
   * Sign in with email and password.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<import('firebase/auth').UserCredential>}
   */
  async signInWithEmailAndPassword(email, password) {
    return fbSignInWithEmailAndPassword(this.#auth, email, password);
  }

  /**
   * Sign in with an SSO provider via popup.
   *
   * @param {'google' | 'clever' | 'classlink' | 'nycps'} providerName
   * @returns {Promise<import('firebase/auth').UserCredential>}
   */
  async signInWithPopup(providerName) {
    const provider = this.#resolveProvider(providerName);
    return fbSignInWithPopup(this.#auth, provider);
  }

  /**
   * Sign in with an SSO provider via redirect.
   *
   * @param {'google' | 'clever' | 'classlink' | 'nycps'} providerName
   * @returns {Promise<void>}
   */
  async signInWithRedirect(providerName) {
    const provider = this.#resolveProvider(providerName);
    return fbSignInWithRedirect(this.#auth, provider);
  }

  /**
   * Get the result of a redirect sign-in.
   *
   * @returns {Promise<import('firebase/auth').UserCredential | null>}
   */
  async getRedirectResult() {
    return fbGetRedirectResult(this.#auth);
  }

  /**
   * Sign in with an email link (magic link).
   *
   * @param {string} email
   * @param {string} emailLink
   * @returns {Promise<import('firebase/auth').UserCredential>}
   */
  async signInWithEmailLink(email, emailLink) {
    return fbSignInWithEmailLink(this.#auth, email, emailLink);
  }

  /**
   * Send a sign-in link to the given email.
   *
   * @param {string} email
   * @param {string} url - The continue URL for the email link.
   * @returns {Promise<void>}
   */
  async sendSignInLinkToEmail(email, url) {
    return fbSendSignInLinkToEmail(this.#auth, email, {
      url,
      handleCodeInApp: true,
    });
  }

  /**
   * Check if a URL is a sign-in with email link.
   *
   * @param {string} link
   * @returns {boolean}
   */
  isSignInWithEmailLink(link) {
    return fbIsSignInWithEmailLink(this.#auth, link);
  }

  /**
   * Create a new user with email and password.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<import('firebase/auth').UserCredential>}
   */
  async createUserWithEmailAndPassword(email, password) {
    return fbCreateUserWithEmailAndPassword(this.#auth, email, password);
  }

  /**
   * Send a password reset email.
   *
   * @param {string} email
   * @returns {Promise<void>}
   */
  async sendPasswordResetEmail(email) {
    return fbSendPasswordResetEmail(this.#auth, email);
  }

  /**
   * Fetch the sign-in methods for an email address.
   *
   * @param {string} email
   * @returns {Promise<string[]>}
   */
  async fetchSignInMethodsForEmail(email) {
    return fbFetchSignInMethodsForEmail(this.#auth, email);
  }

  /**
   * Get the current user's ID token.
   *
   * @param {boolean} [forceRefresh=false] - Force a token refresh.
   * @returns {Promise<string | null>} The ID token, or null if not signed in.
   */
  async getIdToken(forceRefresh = false) {
    const user = this.#auth.currentUser;
    if (!user) return null;
    return getIdToken(user, forceRefresh);
  }

  /**
   * Subscribe to ID token changes (sign-in, sign-out, token refresh).
   *
   * @param {(user: import('firebase/auth').User | null) => void} callback
   * @returns {import('firebase/auth').Unsubscribe} Unsubscribe function.
   */
  onIdTokenChanged(callback) {
    return onIdTokenChanged(this.#auth, callback);
  }

  /**
   * Sign out the current user.
   *
   * @returns {Promise<void>}
   */
  async signOut() {
    return fbSignOut(this.#auth);
  }

  /**
   * Get the currently signed-in user.
   *
   * @returns {import('firebase/auth').User | null}
   */
  getCurrentUser() {
    return this.#auth?.currentUser ?? null;
  }

  /**
   * Resolve a provider name to a Firebase AuthProvider instance.
   *
   * @param {'google' | 'clever' | 'classlink' | 'nycps'} providerName
   * @returns {import('firebase/auth').AuthProvider}
   */
  #resolveProvider(providerName) {
    const factory = SSO_PROVIDER_MAP[providerName];
    if (!factory) {
      throw new Error(`Unknown SSO provider: ${providerName}`);
    }
    return factory();
  }
}

/**
 * Create the AuthService singleton. Call once at bootstrap (App.vue).
 *
 * @param {{ projectId: string, apiKey: string, authDomain: string, emulatorAuthHost?: string }} config
 * @returns {AuthService}
 */
export function createAuthService(config) {
  if (instance) {
    console.warn('[AuthService] Already created — returning existing instance.');
    return instance;
  }
  instance = new AuthService(config);
  return instance;
}

/**
 * Get the AuthService singleton.
 *
 * @returns {AuthService}
 * @throws {Error} If createAuthService() has not been called yet.
 */
export function getAuthService() {
  if (!instance) {
    throw new Error('AuthService not created. Call createAuthService() first.');
  }
  return instance;
}
