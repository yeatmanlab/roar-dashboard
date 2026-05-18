import type { AuthContext } from './auth-context';
import type { DecodedUser } from '../services/auth/auth.service';

declare global {
  namespace Express {
    interface Request {
      /**
       * Authenticated user context.
       * Contains minimal user info (userId, isSuperAdmin) for authorization checks.
       * Only present after successful authentication via auth-guard middleware.
       */
      user?: AuthContext;
      /**
       * Decoded Firebase token for anonymous users.
       * Set by AnonTokenMiddleware on the POST /users/anonymous endpoint.
       * Not present on any other route.
       */
      decodedAnonymousUser?: DecodedUser;
    }
  }
}

export {};
