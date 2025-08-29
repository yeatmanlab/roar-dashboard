import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import { AuthService } from '../../services/auth/auth.service';
import { extractJwt } from './jwt-extractor';
import { getFirebaseErrorCode } from '../../utils/get-firebase-error-code.util';
import { API_ERROR_CODES } from '../../constants/api-error-codes';
import { FIREBASE_ERROR_CODES } from '../../constants/firebase-error-codes';

/**
 * The AuthGuardMiddleware extracts the JWT token from the Authorization header, validates it and uses the AuthService
 * to decode the user information before passing the request to the next middleware.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The Express next function. If successful, the user information is attached to the request.
 *
 * @returns The next function.
 * @throws {HttpError} If the token is missing or invalid.
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

    req.user = await AuthService.verifyToken(token);
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
