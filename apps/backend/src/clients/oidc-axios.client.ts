import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { GoogleAuth } from 'google-auth-library';
import { logger } from '../logger';

/**
 * Create an Axios instance that attaches Google OIDC identity tokens to every request.
 *
 * The interceptor calls `idTokenClient.getRequestHeaders()` on each request. Token caching
 * and refresh are handled internally by `google-auth-library`'s `IdTokenClient`.
 *
 * @param audience - The `aud` claim the identity token must contain
 * @returns An Axios instance with an Authorization header interceptor
 */
export async function createOidcAxiosInstance(audience: string): Promise<AxiosInstance> {
  const auth = new GoogleAuth();
  const idTokenClient = await auth.getIdTokenClient(audience);

  const instance = axios.create();

  instance.interceptors.request.use(async (config) => {
    // getRequestHeaders() returns { Authorization: 'Bearer <token>' } at runtime.
    // The return type resolves to the global Node.js Headers (from @types/node) instead of
    // the library's own { [index: string]: string } interface, so we use .get().
    const headers = await idTokenClient.getRequestHeaders();
    const authorization = headers.get('Authorization');
    if (!authorization) {
      logger.warn({ audience }, 'OIDC identity token missing from request headers, request will be unauthenticated');
    } else {
      config.headers.set('Authorization', authorization);
    }
    return config;
  });

  logger.debug({ audience }, 'Created OIDC Axios instance');

  return instance;
}
