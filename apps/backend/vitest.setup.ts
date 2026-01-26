import { vi, beforeEach } from 'vitest';

// Shared Firebase Admin mocks (vi.mock calls are hoisted)
import './src/test-support/mocks/firebase-admin.mock';

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
