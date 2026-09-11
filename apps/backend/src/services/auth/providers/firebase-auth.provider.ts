import { StatusCodes } from 'http-status-codes';
import { FirebaseAuthClient } from '../../../clients/firebase-auth.clients';
import { FIREBASE_ERROR_CODES } from '../../../constants/firebase-error-codes';
import { ApiErrorCode } from '../../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../../enums/api-error-message.enum';
import { ApiError } from '../../../errors/api-error';
import { logger } from '../../../logger';
import { getFirebaseErrorCode } from '../../../utils/get-firebase-error-code.util';
import type { DecodedUser } from '../auth.service';

/**
 * Firebase Auth Provider
 *
 * Uses Firebase Admin SDK to verify JWT tokens and extract user information.
 * When `FIREBASE_AUTH_EMULATOR_HOST` is set, the Admin SDK automatically
 * connects to the Auth emulator — no code change needed.
 *
 * @throws {ApiError} AUTH_TOKEN_EXPIRED if the token has expired
 * @throws {ApiError} AUTH_TOKEN_INVALID for any other verification failure
 */
export class FirebaseAuthProvider {
  async verifyToken(token: string): Promise<DecodedUser> {
    try {
      const decoded = await FirebaseAuthClient.verifyIdToken(token, true);
      return {
        uid: decoded.uid,
        ...(decoded.email != null ? { email: decoded.email } : {}),
        claims: decoded as unknown as Record<string, unknown>,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      const firebaseCode = getFirebaseErrorCode(error);

      if (firebaseCode === FIREBASE_ERROR_CODES.AUTH.ID_TOKEN_EXPIRED) {
        throw new ApiError(ApiErrorMessage.UNAUTHORIZED, {
          statusCode: StatusCodes.UNAUTHORIZED,
          code: ApiErrorCode.AUTH_TOKEN_EXPIRED,
          cause: error,
        });
      }

      logger.warn({ err: error }, 'Failed to verify Firebase token');
      throw new ApiError(ApiErrorMessage.UNAUTHORIZED, {
        statusCode: StatusCodes.UNAUTHORIZED,
        code: ApiErrorCode.AUTH_TOKEN_INVALID,
        cause: error,
      });
    }
  }
}
