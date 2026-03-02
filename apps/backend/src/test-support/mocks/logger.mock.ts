/**
 * Logger Mocks
 *
 * Shared mock definitions for the logger module.
 * Import this file for side effects in setup files:
 *   import './src/test-support/mocks/logger.mock';
 *
 * vi.mock() calls are hoisted by Vitest, so importing this file
 * will automatically set up the mocks.
 */
import { vi } from 'vitest';

// Create a mock child logger with all logging methods
const mockChild = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
};

vi.mock('../../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => mockChild),
  },
}));
