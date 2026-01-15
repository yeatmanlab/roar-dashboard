import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { FirebaseAuthProvider } from './firebase-auth.provider';
import { FirebaseAuthClient } from '../../../clients/firebase-auth.clients';
import { FirebaseDecodedTokenFactory } from '../../../test-support/factories/auth.factory';
import { ApiError } from '../../../errors/api-error';
import { ApiErrorCode } from '../../../enums/api-error-code.enum';
import { FIREBASE_ERROR_CODES } from '../../../constants/firebase-error-codes';

vi.mock('../../../clients/firebase-auth.clients');
vi.mock('../../../logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('FirebaseAuthProvider', () => {
  let provider: FirebaseAuthProvider;
  let mockVerifyIdToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new FirebaseAuthProvider();
    mockVerifyIdToken = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (FirebaseAuthClient.verifyIdToken as any) = mockVerifyIdToken;
  });

  it('should verify token and return decoded user with email', async () => {
    const mockDecodedToken = FirebaseDecodedTokenFactory.build();

    mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

    const result = await provider.verifyToken('valid-token');

    expect(result).toEqual({
      uid: mockDecodedToken.uid,
      email: mockDecodedToken.email,
      claims: mockDecodedToken,
    });
    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token', true);
  });

  it('should throw ApiError with AUTH_TOKEN_EXPIRED for expired tokens', async () => {
    const expiredError = { code: FIREBASE_ERROR_CODES.AUTH.ID_TOKEN_EXPIRED };
    mockVerifyIdToken.mockRejectedValue(expiredError);

    await expect(provider.verifyToken('expired-token')).rejects.toMatchObject({
      message: 'Token expired.',
      statusCode: StatusCodes.UNAUTHORIZED,
      code: ApiErrorCode.AUTH_TOKEN_EXPIRED,
      cause: expiredError,
    });
  });

  it('should throw ApiError with AUTH_TOKEN_INVALID for invalid tokens', async () => {
    const invalidError = new Error('Token verification failed');
    mockVerifyIdToken.mockRejectedValue(invalidError);

    await expect(provider.verifyToken('invalid-token')).rejects.toMatchObject({
      message: 'Invalid token.',
      statusCode: StatusCodes.UNAUTHORIZED,
      code: ApiErrorCode.AUTH_TOKEN_INVALID,
      cause: invalidError,
    });
  });

  it('should re-throw ApiError without wrapping', async () => {
    const apiError = new ApiError('Already wrapped', {
      statusCode: StatusCodes.BAD_REQUEST,
      code: ApiErrorCode.REQUEST_INVALID,
    });
    mockVerifyIdToken.mockRejectedValue(apiError);

    await expect(provider.verifyToken('test-token')).rejects.toBe(apiError);
  });

  it('should pass checkRevoked parameter as true to Firebase client', async () => {
    const mockDecodedToken = { uid: 'user-123' };
    mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

    await provider.verifyToken('test-token');

    expect(mockVerifyIdToken).toHaveBeenCalledWith('test-token', true);
  });
});
