/**
 * FGA Client Mock
 *
 * Shared mock for the FGA client module. Import this file for side effects
 * in setup files:
 *   import './src/test-support/mocks/fga-client.mock';
 *
 * vi.mock() calls are hoisted by Vitest, so importing this file
 * will automatically set up the mock.
 *
 * The mock returns a no-op client that permits all checks and returns
 * empty object lists. This allows services that depend on AuthorizationService
 * to be instantiated without a running FGA server.
 */
import { vi } from 'vitest';

vi.mock('../../clients/fga.client', () => ({
  FgaClient: {
    getClient: vi.fn(() => ({
      writeTuples: vi.fn(),
      deleteTuples: vi.fn(),
      read: vi.fn().mockResolvedValue({ tuples: [], continuation_token: '' }),
      check: vi.fn().mockResolvedValue({ allowed: true }),
      listObjects: vi.fn().mockResolvedValue({ objects: [] }),
    })),
    clearCache: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));
