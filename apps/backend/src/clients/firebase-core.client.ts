import {
  initializeApp,
  getApp,
  type App,
  type Credential,
  applicationDefault,
  cert,
  getApps,
} from 'firebase-admin/app';

/**
 * FirebaseCoreClient
 *
 * Single-project Firebase core client that exposes a singleton Firebase app instance.
 *
 * The client first attempts to initialize using Application Default Credentials (ADC) when available, or falls back to
 * `FIREBASE_SERVICE_ACCOUNT_CREDENTIALS` (base64-encoded JSON). If neither is available, a final attempt is made to use
 * `applicationDefault()` as a last resort, particularly useful for local development.
 *
 * @example
 *  ```ts
 *    import { FirebaseCoreClient } from './firebase-core.client';
 *    import { getAuth } from 'firebase-admin/auth';
 *
 *    const app = FirebaseCoreClient.getApp();
 *    const auth = getAuth(app);
 *  ```
 */
export class FirebaseCoreClient {
  private static appInstance: App | null = null;

  /**
   * Get the singleton Admin Firebase `App` instance.
   *
   * If already initialized, this method returns the cached app instance. Otherwise, initializes using credentials
   * resolved by `getCredentials()` and caches the instance.
   *
   * @example
   *   ```ts
   *     const app = FirebaseCoreClient.getApp();
   *     const auth = getAuth(app);
   *   ```
   * @returns The initialized Firebase SDK `App`
   */
  public static getApp(): App {
    if (this.appInstance) return this.appInstance;

    // Reuse default app if one exists
    if (getApps().length) {
      this.appInstance = getApp();
      return this.appInstance;
    }

    const credential = this.getCredentials();
    this.appInstance = initializeApp({ credential });
    return this.appInstance;
  }

  /**
   * Retrieve credentials
   *
   * @returns A Firebase `Credential` suitable for Admin SDK initialization
   */
  private static getCredentials(): Credential {
    // Prefer ADC when signals indicate availability
    const hasDefaultCredentials = Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
    );

    if (hasDefaultCredentials) return applicationDefault();

    // Otherwise, fallback to FIREBASE_SERVICE_ACCOUNT_CREDENTIALS (base64-encoded JSON service-account file)
    const encodedJsonCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_CREDENTIALS;
    if (!encodedJsonCredentials) {
      // If nothing else is configured, still attempt ADC as a last resort
      return applicationDefault();
    }

    try {
      const json = Buffer.from(encodedJsonCredentials, 'base64').toString('utf8');
      return cert(JSON.parse(json));
    } catch {
      // @TODO: Replace with actual logger.
      console.error('Failed to parse service account credentials');

      // If parsing fails, attempt ADC as a last resort
      return applicationDefault();
    }
  }

  /**
   * Clears the cached `App` instance.
   *
   * Useful in tests to force re-initialization with different environment variables.
   *
   * @example
   * ```ts
   * beforeEach(() => {
   *   FirebaseCoreClient.clearCache();
   * });
   * ```
   */
  public static clearCache(): void {
    this.appInstance = null;
  }
}
