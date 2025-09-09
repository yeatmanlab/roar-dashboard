import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { getAuth } from 'firebase-admin/auth';

describe('FirebaseAuthClient', () => {
  const getAuthMock = getAuth as Mock;

  it('exports a Firebase Auth instance', async () => {
    // Import the client to trigger initialization
    const { FirebaseAuthClient } = await import('./firebase-auth.clients');

    expect(FirebaseAuthClient).toBeDefined();
    expect(FirebaseAuthClient.app).toEqual({ name: 'mock-app' });
  });

  it('initializes Auth with a Firebase app', async () => {
    await import('./firebase-auth.clients');

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

  it('handles getAuth() errors during initialization', async () => {
    getAuthMock.mockImplementationOnce(() => {
      throw new Error('Auth initialization failed');
    });

    // Clear the module cache to force re-import
    vi.resetModules();

    await expect(async () => {
      await import('./firebase-auth.clients');
    }).rejects.toThrow('Auth initialization failed');
  });

  it('is initialized immediately when module is imported', async () => {
    await import('./firebase-auth.clients');

    // Should have been called during module initialization
    expect(getAuthMock).toHaveBeenCalledTimes(1);
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
