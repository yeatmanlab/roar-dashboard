/**
 * Tests for env-driven auth provider resolution.
 *
 * Separate from auth.service.test.ts because that file uses vi.mock() on the
 * provider modules, which prevents testing the real resolution logic. This file
 * does NOT mock providers, so resolveAuthProvider() creates real instances.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('resolveAuthProvider (env-driven)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('should use TestAuthProvider when AUTH_PROVIDER=test', async () => {
    vi.stubEnv('AUTH_PROVIDER', 'test');

    const { AuthService } = await import('./auth.service');

    expect(AuthService.getProviderName()).toBe('TestAuthProvider');

    // TestAuthProvider treats the token string as the UID directly
    const result = await AuthService.verifyToken('test-uid-123');
    expect(result).toEqual({ uid: 'test-uid-123', claims: {} });
  });

  it('should use FirebaseAuthProvider when AUTH_PROVIDER is unset', async () => {
    delete process.env.AUTH_PROVIDER;

    const { AuthService } = await import('./auth.service');

    expect(AuthService.getProviderName()).toBe('FirebaseAuthProvider');
  });

  it('should use FirebaseAuthProvider for unknown AUTH_PROVIDER values', async () => {
    vi.stubEnv('AUTH_PROVIDER', 'unknown');

    const { AuthService } = await import('./auth.service');

    expect(AuthService.getProviderName()).toBe('FirebaseAuthProvider');
  });
});
