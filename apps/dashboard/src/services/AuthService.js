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
 * Outcome of the one-time auth readiness resolution.
 *
 * @typedef {object} AuthReadyState
 * @property {import('firebase/auth').User | null} user - The signed-in user, or null if signed out.
 * @property {string | null} accessToken - The signed-in user's ID token, resolved as part of
 *   readiness so a caller can write it synchronously before the gate opens; null when signed out.
 * @property {boolean} isFromRedirect - True when the session was just established by a pending
 *   SSO redirect result, as opposed to restored from persistence on an ordinary load.
 * @property {unknown} initError - Firebase initialization failure, if any.
 * @property {unknown} redirectError - Pending-SSO-redirect failure, if any.
 * @property {unknown} tokenError - ID-token resolution failure, if any (e.g. an offline reload
 *   with an expired token). The session may still be present (`user` set) with a null token.
 */

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
  /** @type {Promise<void> | null} */
  #initPromise = null;
  /** @type {Promise<AuthReadyState> | null} */
  #readyPromise = null;
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
   *
   * Memoized on the promise (not a boolean) so concurrent callers — the app
   * bootstrap and a sign-in method racing it — share a single initialization
   * run instead of double-initializing. A failed run clears the memo so the
   * next caller retries.
   */
  async initialize() {
    if (!this.#initPromise) {
      this.#initPromise = this.#doInitialize().catch((error) => {
        this.#initPromise = null;
        throw error;
      });
    }
    return this.#initPromise;
  }

  async #doInitialize() {
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
  }

  /**
   * Resolve once the session is known: Firebase initialized, any pending SSO
   * redirect consumed, and the first `onIdTokenChanged` emission observed.
   *
   * This is the app's single ordering guarantee. Before it resolves, "no
   * user" is ambiguous — it means either "signed out" or "Firebase has not
   * reported yet". After it resolves, `getCurrentUser()` is a synchronous
   * fact, so the router guard and the SSO landing page can branch on session
   * presence without a timer guessing between those two cases.
   *
   * Memoized on the promise, so the first navigation pays the wait and later
   * callers resolve instantly.
   *
   * Never rejects. A failed initialization or a rejected redirect result is
   * carried back as state — callers decide what to do with a degraded
   * session, and an auth failure must not reject a navigation guard.
   *
   * @returns {Promise<AuthReadyState>}
   */
  async authReady() {
    if (!this.#readyPromise) {
      this.#readyPromise = this.#doAuthReady();
    }
    return this.#readyPromise;
  }

  /**
   * @returns {Promise<AuthReadyState>}
   */
  async #doAuthReady() {
    /** @type {AuthReadyState} */
    const state = {
      user: null,
      accessToken: null,
      isFromRedirect: false,
      initError: null,
      redirectError: null,
      tokenError: null,
    };

    try {
      await this.initialize();
    } catch (error) {
      // Without a Firebase instance there is no session to observe and
      // nothing to wait for. Report it and let the caller degrade.
      state.initError = error;
      return state;
    }

    // Consume the pending redirect before observing the token listener: a
    // returning SSO user is signed in by `getRedirectResult()`, so resolving
    // it first means the emission we observe below already reflects them.
    // Record whether it produced a credential — a redirect return is
    // mid-sign-in and needs the spinner held; a session restored from
    // persistence on an ordinary load does not.
    try {
      const redirectResult = await fbGetRedirectResult(this.#auth);
      state.isFromRedirect = redirectResult !== null;
    } catch (error) {
      // A failed redirect leaves the user signed out rather than broken —
      // the listener below still reports the (absent) session correctly, so
      // carry the error and keep going instead of returning early.
      state.redirectError = error;
    }

    // `onIdTokenChanged` fires once with the restored session (or null)
    // immediately after initialization, which is the signal that Firebase
    // has finished resolving persisted state. Unsubscribe on the first
    // emission — the auth store owns the long-lived listener.
    state.user = await new Promise((resolve) => {
      // Firebase can invoke the callback synchronously, before
      // `onIdTokenChanged` returns the unsubscribe handle. Record that the
      // first emission already arrived and tear down after the handle
      // exists, rather than referencing it from inside the callback.
      let settled = false;
      /** @type {import('firebase/auth').Unsubscribe | null} */
      let unsubscribe = null;

      unsubscribe = onIdTokenChanged(this.#auth, (user) => {
        settled = true;
        // Null on a synchronous emission — torn down just below instead.
        if (unsubscribe) unsubscribe();
        resolve(user ?? null);
      });

      if (settled) unsubscribe();
    });

    // Resolve the ID token as part of readiness. The store's long-lived
    // listener also derives the token, but it does so AFTER an extra
    // `await getIdToken()` in its own callback — so a caller that writes
    // `accessToken` from this state resolves the gate only once the token is
    // known, closing the window where the gate opened but the store had not
    // yet written the token (which bounced a successful SSO sign-in back to
    // SignIn). `getIdToken` returns null when signed out.
    //
    // Wrapped in try/catch: `getIdToken` rejects with
    // `auth/network-request-failed` when a restored session's token is expired
    // and the refresh can't reach the network (an offline reload). This
    // promise is memoized and awaited by the router guard, which must never
    // reject — so a token failure degrades to a null token carried as
    // `tokenError`, not a thrown navigation. The long-lived listener retries
    // the token on the next emission.
    try {
      state.accessToken = await this.getIdToken();
    } catch (error) {
      state.tokenError = error;
    }

    return state;
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
    await this.initialize();
    return fbSignInWithEmailAndPassword(this.#auth, email, password);
  }

  /**
   * Sign in with an SSO provider via popup.
   *
   * @param {'google' | 'clever' | 'classlink' | 'nycps'} providerName
   * @returns {Promise<import('firebase/auth').UserCredential>}
   */
  async signInWithPopup(providerName) {
    // The router gate (`authReady()`, awaited in `beforeEach`) is the app's
    // ordering guarantee: no route renders before initialization finishes.
    // These per-method awaits are belt-and-suspenders behind it — they cost
    // nothing once the memo is warm, and they keep direct callers of the
    // service (tests, the assessment auth callbacks) correct without
    // depending on a navigation having happened first.
    await this.initialize();
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
    // See signInWithPopup — sign-ins await initialization themselves.
    await this.initialize();
    const provider = this.#resolveProvider(providerName);
    return fbSignInWithRedirect(this.#auth, provider);
  }

  /**
   * Get the result of a redirect sign-in.
   *
   * @returns {Promise<import('firebase/auth').UserCredential | null>}
   */
  async getRedirectResult() {
    // Note: `authReady()` already consumes the pending redirect during
    // bootstrap, so a caller here on a normal app load gets `null` — the
    // result was claimed by the gate. Kept for callers that drive the
    // service directly, outside the router's lifecycle.
    await this.initialize();
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
    await this.initialize();
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
    await this.initialize();
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
   * Send a password reset email.
   *
   * @param {string} email
   * @returns {Promise<void>}
   */
  async sendPasswordResetEmail(email) {
    await this.initialize();
    return fbSendPasswordResetEmail(this.#auth, email);
  }

  /**
   * Fetch the sign-in methods for an email address.
   *
   * @param {string} email
   * @returns {Promise<string[]>}
   */
  async fetchSignInMethodsForEmail(email) {
    await this.initialize();
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
    await this.initialize();
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
