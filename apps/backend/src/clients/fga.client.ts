import { OpenFgaClient } from '@openfga/sdk';
import { logger } from '../logger';

/**
 * FgaClient
 *
 * Lazy singleton wrapper around `OpenFgaClient` from the OpenFGA SDK.
 *
 * Follows the same pattern as `FirebaseCoreClient` — the client is created on first access
 * and cached for subsequent calls. This avoids crashing at import time when env vars aren't
 * set (e.g., in tests that don't need FGA).
 *
 * Required environment variables:
 * - `FGA_API_URL` — OpenFGA server URL (e.g., `https://localhost:5050`)
 * - `FGA_STORE_ID` — Store ID from `fga store create`
 * - `FGA_MODEL_ID` — Authorization model ID from `fga store create`
 *
 * @example
 * ```ts
 * import { FgaClient } from './fga.client';
 *
 * const fga = FgaClient.getClient();
 * ```
 */
export class FgaClient {
  private static instance: OpenFgaClient | null = null;

  /**
   * Get the singleton OpenFGA client instance.
   *
   * Initializes the client on first call using environment variables.
   * Subsequent calls return the cached instance.
   *
   * @returns The initialized `OpenFgaClient`
   * @throws {Error} If required environment variables are missing
   */
  public static getClient(): OpenFgaClient {
    if (this.instance) return this.instance;

    const apiUrl = process.env.FGA_API_URL;
    const storeId = process.env.FGA_STORE_ID;
    const authorizationModelId = process.env.FGA_MODEL_ID;

    if (!apiUrl || !storeId || !authorizationModelId) {
      throw new Error('Missing required FGA environment variables: FGA_API_URL, FGA_STORE_ID, FGA_MODEL_ID');
    }

    logger.debug({ apiUrl, storeId, authorizationModelId }, 'Initializing OpenFGA client');

    this.instance = new OpenFgaClient({
      apiUrl,
      storeId,
      authorizationModelId,
    });

    return this.instance;
  }

  /**
   * Clears the cached client instance.
   *
   * Useful in tests to force re-initialization with different environment variables.
   *
   * @example
   * ```ts
   * beforeEach(() => {
   *   FgaClient.clearCache();
   * });
   * ```
   */
  public static clearCache(): void {
    this.instance = null;
  }
}
