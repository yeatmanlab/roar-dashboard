import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthServiceFactory } from './auth.service';
import { FirebaseAuthProvider } from './providers/firebase-auth.provider';
import { DecodedUserFactory } from '../../test-support/factories/auth.factory';
import type { AuthProvider } from './auth-provider.interface';

describe('AuthService', () => {
  let mockVerifyToken: ReturnType<typeof vi.fn>;
  let authProvider: AuthProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyToken = vi.fn();
    // Injected directly — no module mocking, and no reaching into service internals.
    authProvider = { verifyToken: mockVerifyToken };
  });

  it('verifies a token and returns the decoded user', async () => {
    const mockUser = DecodedUserFactory.build();
    mockVerifyToken.mockResolvedValue(mockUser);

    const result = await AuthServiceFactory({ authProvider }).verifyToken('mock-valid-token');

    expect(result).toEqual(mockUser);
    expect(mockVerifyToken).toHaveBeenCalledWith('mock-valid-token');
  });

  it('propagates provider errors', async () => {
    const error = new Error('Token verification failed');
    mockVerifyToken.mockRejectedValue(error);

    const service = AuthServiceFactory({ authProvider });

    await expect(service.verifyToken('invalid-token')).rejects.toThrow('Token verification failed');
    expect(mockVerifyToken).toHaveBeenCalledWith('invalid-token');
  });

  it('reports the injected provider name', () => {
    expect(AuthServiceFactory({ authProvider }).getProviderName()).toBe('Object');
  });

  it('defaults to the Firebase provider when none is injected', () => {
    expect(AuthServiceFactory().getProviderName()).toBe(FirebaseAuthProvider.name);
  });
});
