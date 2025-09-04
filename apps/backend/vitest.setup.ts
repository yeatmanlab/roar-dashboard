import { vi, beforeEach } from 'vitest';

// Global mock for firebase-admin/app
vi.mock('firebase-admin/app', () => {
  const initializeApp = vi.fn();
  const getApp = vi.fn();
  const getApps = vi.fn(() => []);
  const applicationDefault = vi.fn(() => ({ __type: 'mock-adc-credential' }));
  const cert = vi.fn((json) => ({ __type: 'mock-cert-credential', json }));

  return {
    initializeApp,
    getApp,
    getApps,
    applicationDefault,
    cert,
  };
});

// Global mock for firebase-admin/auth
vi.mock('firebase-admin/auth', () => {
  const getAuth = vi.fn(() => ({
    name: 'mock-auth-instance',
    app: { name: 'mock-app' },
    verifyIdToken: vi.fn(),
    createUser: vi.fn(),
    getUserByEmail: vi.fn(),
    deleteUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
    createCustomToken: vi.fn(),
    listUsers: vi.fn(),
    updateUser: vi.fn(),
  }));

  return {
    getAuth,
  };
});

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
