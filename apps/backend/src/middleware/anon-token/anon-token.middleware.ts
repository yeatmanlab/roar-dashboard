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
 * Narrows `claims['firebase']` once and returns both the sign-in provider string
 * and whether it indicates an anonymous sign-in.
 *
 * Centralising the narrowing here prevents the same `typeof firebase` guard from
 * being duplicated across the boolean check and the log-context extraction.
 */
function parseFirebaseClaims(claims: Record<string, unknown>): {
  isAnonymous: boolean;
  signInProvider: string | undefined;
} {
  const firebase = claims['firebase'];
  if (typeof firebase !== 'object' || firebase === null) {
    return { isAnonymous: false, signInProvider: undefined };
  }
  const provider = (firebase as Record<string, unknown>)['sign_in_provider'];
  const signInProvider = typeof provider === 'string' ? provider : undefined;
  return { isAnonymous: signInProvider === ANONYMOUS_SIGN_IN_PROVIDER, signInProvider };
}

/**
 * Returns true when the decoded token's Firebase claims indicate an anonymous sign-in.
 *
 * @param claims - The raw claims object from the decoded Firebase token.
 */
export function isAnonymousToken(claims: Record<string, unknown>): boolean {
  return parseFirebaseClaims(claims).isAnonymous;
}

/**
 * Middleware for the POST /users/anonymous endpoint.
 *
 * Verifies the Authorization header contains a valid Firebase anonymous ID token,
 * then attaches the decoded user to `req.decodedAnonymousUser`.
 *
 * Returns 401 if:
 * - No Authorization header is present, or it is not a well-formed `Bearer <token>` header
 * - The token is invalid or expired
 *
 * Returns 403 if:
 * - The token is valid but not from an anonymous sign-in (e.g., email/password or Google).
 *   The caller is authenticated, so this is an authorization failure, not a missing credential.
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

    if (!isAnonymous) {
      logger.warn(
        { uid: decodedUser.uid, signInProvider },
        'Non-anonymous token presented to anonymous-only endpoint — likely a client misconfiguration',
      );
      // 403, not 401: the caller authenticated successfully, but with the wrong credential
      // type for this endpoint. Signing in again cannot help, so the client needs to tell
      // "sign in" apart from "use an anonymous session here".
      return next(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
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
