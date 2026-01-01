import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import { AuthService } from '../../services/auth/auth.service';
import { UserService } from '../../services/user';
import { extractJwt } from './jwt-extractor';
import { getFirebaseErrorCode } from '../../utils/get-firebase-error-code.util';
import { API_ERROR_CODES } from '../../constants/api-error-codes';
import { FIREBASE_ERROR_CODES } from '../../constants/firebase-error-codes';

// Create service instance (repository auto-instantiated with correct DB client)
const userService = UserService();

/**
 * The AuthGuardMiddleware extracts the JWT token from the Authorization header, validates it and uses the AuthService
 * to decode the user information before passing the request to the next middleware.
 *
 * After verifying the Firebase token, it looks up the user in PostgreSQL and attaches
 * a minimal AuthContext ({ id, userType }) to req.user for authorization checks.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The Express next function. If successful, the user information is attached to the request.
 *
 * @returns The next function.
 * @throws {HttpError} If the token is missing, invalid, or the user is not found in the database.
 */
export async function AuthGuardMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractJwt(req);
    if (!token)
      return next(
        createError(StatusCodes.UNAUTHORIZED, {
          message: 'Token missing.',
          code: API_ERROR_CODES.AUTH.REQUIRED,
        }),
      );

    // Verify Firebase token
    const decodedUser = await AuthService.verifyToken(token);

    // Look up user in PostgreSQL by Firebase auth ID
    const user = await userService.findByAuthId(decodedUser.uid);
    if (!user) {
      return next(
        createError(StatusCodes.UNAUTHORIZED, {
          message: 'User not found.',
          code: API_ERROR_CODES.AUTH.USER_NOT_FOUND,
        }),
      );
    }

    // Attach minimal auth context
    req.user = {
      id: user.id,
      userType: user.userType,
    };

    return next();
  } catch (error) {
    const firebaseCode: string | undefined = getFirebaseErrorCode(error);

    if (firebaseCode === FIREBASE_ERROR_CODES.AUTH.ID_TOKEN_EXPIRED) {
      return next(
        createError(StatusCodes.UNAUTHORIZED, {
          message: 'Token expired.',
          code: API_ERROR_CODES.AUTH.TOKEN_EXPIRED,
        }),
      );
    }

    console.error('Failed to verify token.', { error });
    return next(
      createError(StatusCodes.UNAUTHORIZED, {
        message: 'Invalid token.',
        code: API_ERROR_CODES.AUTH.TOKEN_INVALID,
      }),
    );
  }
}
