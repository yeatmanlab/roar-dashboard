import { OpenFgaClient } from '@openfga/sdk';
import { StatusCodes } from 'http-status-codes';
import type { AxiosInstance } from 'axios';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';
import { ApiError } from '../errors/api-error';
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
 * In deployed environments, call `initialize()` at startup to pre-create the client with
 * OIDC authentication. When `FGA_OIDC_AUDIENCE` is set, the client uses a custom Axios
 * instance that attaches Google identity tokens to every request.
 *
 * Required environment variables:
 * - `FGA_API_URL` — OpenFGA server URL (e.g., `https://localhost:5050`)
 * - `FGA_STORE_ID` — Store ID from `fga store create`
 * - `FGA_MODEL_ID` — Authorization model ID from `fga store create`
 *
 * Optional environment variables:
 * - `FGA_OIDC_AUDIENCE` — When set, enables OIDC authentication with Google identity tokens
 *
 * @example
 * ```ts
 * import { FgaClient } from './fga.client';
 *
 * // At startup (server.ts):
 * await FgaClient.initialize();
 *
 * // Everywhere else:
 * const fga = FgaClient.getClient();
 * ```
 */
export class FgaClient {
  private static instance: OpenFgaClient | null = null;

  /**
   * Pre-initialize the FGA client at server startup.
   *
   * When `FGA_OIDC_AUDIENCE` is set, creates an OIDC-authenticated Axios instance and
   * pre-initializes the singleton with it. When unset, this is a no-op — the client
   * will be lazily created without auth on first `getClient()` call.
   *
   * Safe to call multiple times — subsequent calls are no-ops if the client is already initialized.
   *
   * @throws {ApiError} If `FGA_OIDC_AUDIENCE` is set but required FGA env vars are missing
   */
  public static async initialize(): Promise<void> {
    const audience = process.env.FGA_OIDC_AUDIENCE;
    if (!audience) {
      logger.debug('FGA_OIDC_AUDIENCE not set, skipping OIDC initialization');
      return;
    }

    if (this.instance) {
      logger.debug('FGA client already initialized, skipping OIDC re-initialization');
      return;
    }

    // Dynamically import to avoid loading google-auth-library in local dev / tests
    const { createOidcAxiosInstance } = await import('./oidc-axios.client');
    const axiosInstance = await createOidcAxiosInstance(audience);

    this.createClient(axiosInstance);

    logger.info({ audience }, 'FGA client initialized with OIDC authentication');
  }

  /**
   * Get the singleton OpenFGA client instance.
   *
   * Initializes the client on first call using environment variables.
   * Subsequent calls return the cached instance.
   *
   * @returns The initialized `OpenFgaClient`
   * @throws {ApiError} If required environment variables are missing
   */
  public static getClient(): OpenFgaClient {
    if (this.instance) return this.instance;

    return this.createClient();
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

  /**
   * Create and cache a new OpenFGA client.
   *
   * @param axiosInstance - Optional custom Axios instance (used for OIDC auth)
   * @returns The initialized `OpenFgaClient`
   * @throws {ApiError} If required environment variables are missing
   */
  private static createClient(axiosInstance?: AxiosInstance): OpenFgaClient {
    const apiUrl = process.env.FGA_API_URL;
    const storeId = process.env.FGA_STORE_ID;
    const authorizationModelId = process.env.FGA_MODEL_ID;

    if (!apiUrl || !storeId || !authorizationModelId) {
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL,
        context: { missingVars: { apiUrl: !apiUrl, storeId: !storeId, authorizationModelId: !authorizationModelId } },
      });
    }

    logger.debug({ apiUrl, storeId, authorizationModelId }, 'Initializing OpenFGA client');

    this.instance = new OpenFgaClient({ apiUrl, storeId, authorizationModelId }, axiosInstance);

    return this.instance;
  }
}
