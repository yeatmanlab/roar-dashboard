import type { AuthContext } from './auth-context';

declare global {
  namespace Express {
    interface Request {
      /**
       * Authenticated user context.
       * Contains minimal user info (userId, isSuperAdmin) for authorization checks.
       * Only present after successful authentication via auth-guard middleware.
       */
      user?: AuthContext;
    }
  }
}

export {};
