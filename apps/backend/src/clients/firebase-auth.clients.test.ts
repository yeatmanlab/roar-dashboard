import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { getAuth } from 'firebase-admin/auth';

describe('FirebaseAuthClient', () => {
  const getAuthMock = getAuth as Mock;

  beforeEach(() => {
    vi.resetModules();
  });

  it('exports a Firebase Auth instance', async () => {
    // Import the client; the Proxy lazily initializes on first property access
    const { FirebaseAuthClient } = await import('./firebase-auth.clients');

    expect(FirebaseAuthClient).toBeDefined();
    expect(FirebaseAuthClient.app).toEqual({ name: 'mock-app' });
  });

  it('does not initialize Auth at module import time (lazy via Proxy)', async () => {
    await import('./firebase-auth.clients');

    // No property access yet — getAuth must not have been called
    expect(getAuthMock).not.toHaveBeenCalled();
  });

  it('initializes Auth on first property access', async () => {
    const { FirebaseAuthClient } = await import('./firebase-auth.clients');

    expect(getAuthMock).not.toHaveBeenCalled();
    // Trigger a property read — proxy resolves the underlying Auth instance
    void FirebaseAuthClient.app;
    expect(getAuthMock).toHaveBeenCalledTimes(1);

    // Subsequent reads reuse the cached instance
    void FirebaseAuthClient.app;
    expect(getAuthMock).toHaveBeenCalledTimes(1);
  });

  it('provides access to Firebase Auth methods', async () => {
    const { FirebaseAuthClient } = await import('./firebase-auth.clients');

    // Verify that the Auth instance has the expected methods
    expect(FirebaseAuthClient.verifyIdToken).toBeDefined();
    expect(FirebaseAuthClient.createUser).toBeDefined();
    expect(FirebaseAuthClient.getUserByEmail).toBeDefined();
    expect(FirebaseAuthClient.deleteUser).toBeDefined();
    expect(FirebaseAuthClient.setCustomUserClaims).toBeDefined();
    expect(FirebaseAuthClient.createCustomToken).toBeDefined();
    expect(FirebaseAuthClient.listUsers).toBeDefined();
    expect(FirebaseAuthClient.updateUser).toBeDefined();

    expect(typeof FirebaseAuthClient.verifyIdToken).toBe('function');
    expect(typeof FirebaseAuthClient.createUser).toBe('function');
    expect(typeof FirebaseAuthClient.getUserByEmail).toBe('function');
    expect(typeof FirebaseAuthClient.deleteUser).toBe('function');
    expect(typeof FirebaseAuthClient.setCustomUserClaims).toBe('function');
    expect(typeof FirebaseAuthClient.createCustomToken).toBe('function');
    expect(typeof FirebaseAuthClient.listUsers).toBe('function');
    expect(typeof FirebaseAuthClient.updateUser).toBe('function');
  });

  it('surfaces getAuth() errors on first property access (deferred until use)', async () => {
    getAuthMock.mockImplementationOnce(() => {
      throw new Error('Auth initialization failed');
    });

    // Clear the module cache to force re-import
    vi.resetModules();

    // Import does NOT throw — initialization is deferred behind the Proxy
    const { FirebaseAuthClient } = await import('./firebase-auth.clients');

    // The error surfaces when any property is accessed
    expect(() => FirebaseAuthClient.app).toThrow('Auth initialization failed');
  });

  it('defers initialization until first property access', async () => {
    await import('./firebase-auth.clients');

    // Importing alone should not have triggered getAuth
    expect(getAuthMock).not.toHaveBeenCalled();
  });

  it('maintains consistent auth instance across multiple imports', async () => {
    const { FirebaseAuthClient: mockClient1 } = await import('./firebase-auth.clients');
    const { FirebaseAuthClient: mockClient2 } = await import('./firebase-auth.clients');

    expect(mockClient1).toBe(mockClient2);
    expect(mockClient1.app).toBe(mockClient2.app);
  });

  it('can call auth methods through the client', async () => {
    const { FirebaseAuthClient } = await import('./firebase-auth.clients');

    // Test that methods can be called (they're mocked so won't do anything real)
    expect(() => FirebaseAuthClient.verifyIdToken('mock-fake-token')).not.toThrow();
    expect(() => FirebaseAuthClient.createUser({ email: 'mock-user@example.com' })).not.toThrow();
    expect(() => FirebaseAuthClient.getUserByEmail('mocker-user@example.com')).not.toThrow();

    // Verify the mocked methods were called
    expect(FirebaseAuthClient.verifyIdToken).toHaveBeenCalledWith('mock-fake-token');
    expect(FirebaseAuthClient.createUser).toHaveBeenCalledWith({ email: 'mock-user@example.com' });
    expect(FirebaseAuthClient.getUserByEmail).toHaveBeenCalledWith('mocker-user@example.com');
  });
});
