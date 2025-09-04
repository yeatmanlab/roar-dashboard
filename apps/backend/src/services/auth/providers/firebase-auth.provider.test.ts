import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAuthProvider } from './firebase-auth.provider';
import { FirebaseAuthClient } from '../../../clients/firebase-auth.clients';
import { FirebaseDecodedTokenFactory } from '../../../test-support/factories/auth.factory';

vi.mock('../../../clients/firebase-auth.clients');

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

  it('should propagate Firebase client errors', async () => {
    const error = new Error('Token verification failed');
    mockVerifyIdToken.mockRejectedValue(error);

    await expect(provider.verifyToken('invalid-token')).rejects.toThrow('Token verification failed');
    expect(mockVerifyIdToken).toHaveBeenCalledWith('invalid-token', true);
  });

  it('should pass checkRevoked parameter as true to Firebase client', async () => {
    const mockDecodedToken = { uid: 'user-123' };
    mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

    await provider.verifyToken('test-token');

    expect(mockVerifyIdToken).toHaveBeenCalledWith('test-token', true);
  });
});
