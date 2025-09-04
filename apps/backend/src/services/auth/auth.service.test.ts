import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { FirebaseAuthProvider } from './providers/firebase-auth.provider';
import { DecodedUserFactory } from '../../test-support/factories/auth.factory';
import type { MockedClass } from 'vitest';

vi.mock('./providers/firebase-auth.provider');

const MockedFirebaseAuthProvider = FirebaseAuthProvider as MockedClass<typeof FirebaseAuthProvider>;

describe('AuthService', () => {
  let mockVerifyToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the provider
    mockVerifyToken = vi.fn();
    MockedFirebaseAuthProvider.mockImplementation(() => ({ verifyToken: mockVerifyToken }));

    // Reset the static provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (AuthService as any).provider = new FirebaseAuthProvider();
  });

  it('should delegate token verification to provider', async () => {
    const token = 'test-jwt-token';
    const mockUser = DecodedUserFactory.build();

    mockVerifyToken.mockResolvedValue(mockUser);

    await AuthService.verifyToken(token);

    expect(mockVerifyToken).toHaveBeenCalledOnce();
    expect(mockVerifyToken).toHaveBeenCalledWith(token);
  });

  it('should verify token and return decoded user', async () => {
    const mockUser = DecodedUserFactory.build();

    mockVerifyToken.mockResolvedValue(mockUser);

    const result = await AuthService.verifyToken('mock-valid-token');

    expect(result).toEqual(mockUser);
    expect(mockVerifyToken).toHaveBeenCalledWith('mock-valid-token');
  });

  it('should propagate provider errors', async () => {
    const error = new Error('Token verification failed');
    mockVerifyToken.mockRejectedValue(error);

    await expect(AuthService.verifyToken('invalid-token')).rejects.toThrow('Token verification failed');
    expect(mockVerifyToken).toHaveBeenCalledWith('invalid-token');
  });

  it('should use the same provider instance for multiple calls', async () => {
    const mockUser = DecodedUserFactory.build();
    mockVerifyToken.mockResolvedValue(mockUser);

    await AuthService.verifyToken('token1');
    await AuthService.verifyToken('token2');

    expect(mockVerifyToken).toHaveBeenCalledTimes(2);
    expect(mockVerifyToken).toHaveBeenNthCalledWith(1, 'token1');
    expect(mockVerifyToken).toHaveBeenNthCalledWith(2, 'token2');
  });
});
