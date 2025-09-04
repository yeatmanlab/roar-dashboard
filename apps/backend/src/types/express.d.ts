import type { DecodedUser } from '../services/auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: DecodedUser;
    }
  }
}

export {};
