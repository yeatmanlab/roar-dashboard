import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { AuthService } from '../../services/auth/auth.service';
import { UserService } from '../../services/user';
import { extractJwt } from './jwt-extractor';

// Create service instance (repository auto-instantiated with correct DB client)
const userService = UserService();
/**
 * Check if a user's rostering has ended.
 *
 * @param rosteringEnded - The rostering end date (nullable).
 * @returns True if the rostering has ended (non-null and in the past), false otherwise.
 */
const isRosteringEnded = (rosteringEnded: Date | null): boolean => {
  return rosteringEnded !== null && rosteringEnded <= new Date();
};

/**
 * The AuthGuardMiddleware extracts the JWT token from the Authorization header, validates it and uses the AuthService
 * to decode the user information before passing the request to the next middleware.
 *
 * After verifying the Firebase token, it looks up the user in PostgreSQL and attaches
 * a minimal AuthContext ({ userId, isSuperAdmin }) to req.user for authorization checks.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The Express next function. If successful, the user information is attached to the request.
 *
 * @returns The next function.
 * @throws {ApiError} If the token is missing, invalid, the user is not found, or the user's rostering has ended.
 */
export async function AuthGuardMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractJwt(req);
    if (!token) {
      return next(
        new ApiError('Token missing.', {
          statusCode: StatusCodes.UNAUTHORIZED,
          code: ApiErrorCode.AUTH_REQUIRED,
        }),
      );
    }

    // Verify Firebase token
    const decodedUser = await AuthService.verifyToken(token);

    // Look up user in PostgreSQL by Firebase auth ID
    const user = await userService.findByAuthId(decodedUser.uid);
    if (!user) {
      return next(
        new ApiError('User not found.', {
          statusCode: StatusCodes.UNAUTHORIZED,
          code: ApiErrorCode.AUTH_USER_NOT_FOUND,
        }),
      );
    }

    // Block users whose rostering has ended — rosteringEnded is non-null and in the past
    if (isRosteringEnded(user.rosteringEnded)) {
      logger.warn(
        { userId: user.id, rosteringEnded: user.rosteringEnded },
        'Rostering-ended user attempted authentication',
      );
      return next(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_ROSTERING_ENDED,
          context: { userId: user.id, rosteringEnded: user.rosteringEnded },
        }),
      );
    }

    // Attach minimal auth context
    req.user = {
      userId: user.id,
      isSuperAdmin: user.isSuperAdmin ?? false,
    };

    return next();
  } catch (error) {
    // ApiError from AuthService (token expired/invalid) or UserService (DB error)
    if (error instanceof ApiError) {
      return next(error);
    }

    // Unexpected error - should not happen if services handle errors properly
    return next(
      new ApiError('Authentication failed.', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL,
        cause: error,
      }),
    );
  }
}
