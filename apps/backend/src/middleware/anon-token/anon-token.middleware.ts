import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { AuthService } from '../../services/auth/auth.service';
import { extractJwt } from '../auth-guard/jwt-extractor';

const ANONYMOUS_SIGN_IN_PROVIDER = 'anonymous';

/**
 * Returns true when the decoded token's Firebase claims indicate an anonymous sign-in.
 *
 * `claims['firebase']` is `unknown` at runtime; this function narrows it safely
 * rather than relying on a bare `as` cast at the call site.
 *
 * @param claims - The raw claims object from the decoded Firebase token.
 */
export function isAnonymousToken(claims: Record<string, unknown>): boolean {
  const firebase = claims['firebase'];
  if (typeof firebase !== 'object' || firebase === null) return false;
  return (firebase as Record<string, unknown>)['sign_in_provider'] === ANONYMOUS_SIGN_IN_PROVIDER;
}

/**
 * Middleware for the POST /users/anonymous endpoint.
 *
 * Verifies the Authorization header contains a valid Firebase anonymous ID token,
 * then attaches the decoded user to `req.decodedAnonymousUser`.
 *
 * Returns 401 if:
 * - No Authorization header is present
 * - The token is invalid or expired
 * - The token is not from an anonymous sign-in (e.g., email/password or Google)
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The Express next function.
 */
export async function AnonTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractJwt(req);
    if (!token) {
      return next(
        new ApiError(ApiErrorMessage.UNAUTHORIZED, {
          statusCode: StatusCodes.UNAUTHORIZED,
          code: ApiErrorCode.AUTH_REQUIRED,
        }),
      );
    }

    const decodedUser = await AuthService.verifyToken(token);
    const { isAnonymous, signInProvider } = parseFirebaseClaims(decodedUser.claims);

    if (!isAnonymousToken(decodedUser.claims)) {
      const firebase = decodedUser.claims['firebase'];
      const signInProvider =
        typeof firebase === 'object' && firebase !== null
          ? (firebase as Record<string, unknown>)['sign_in_provider']
          : undefined;
      logger.warn(
        { uid: decodedUser.uid, signInProvider },
        'Non-anonymous token presented to anonymous-only endpoint — likely a client misconfiguration',
      );
      return next(
        new ApiError(ApiErrorMessage.UNAUTHORIZED, {
          statusCode: StatusCodes.UNAUTHORIZED,
          code: ApiErrorCode.AUTH_REQUIRED,
          context: { uid: decodedUser.uid },
        }),
      );
    }

    req.decodedAnonymousUser = decodedUser;
    return next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }

    return next(
      new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL,
        cause: error,
      }),
    );
  }
}
