import type { AuthContext } from '../services/auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      /**
       * Authenticated user context.
       * Contains minimal user info (id, userType) for authorization checks.
       * Only present after successful authentication via auth-guard middleware.
       */
      user?: AuthContext;
    }
  }
}

export {};
