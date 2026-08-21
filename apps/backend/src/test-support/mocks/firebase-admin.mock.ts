/**
 * Firebase Admin Mocks
 *
 * Shared mock definitions for firebase-admin modules.
 * Import this file for side effects in setup files:
 *   import './src/test-support/mocks/firebase-admin.mock';
 *
 * vi.mock() calls are hoisted by Vitest, so importing this file
 * will automatically set up the mocks.
 */
import { vi } from 'vitest';

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn(),
  getApps: vi.fn(() => []),
  applicationDefault: vi.fn(() => ({ __type: 'mock-adc-credential' })),
  cert: vi.fn((json) => ({ __type: 'mock-cert-credential', json })),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
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
  })),
}));
