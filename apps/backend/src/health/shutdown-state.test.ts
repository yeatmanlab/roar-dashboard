import { describe, it, expect, beforeEach } from 'vitest';
import { isShuttingDown, setShuttingDown, resetShuttingDown } from './shutdown-state';

beforeEach(() => {
  resetShuttingDown();
});

describe('shutdown-state', () => {
  it('starts as not shutting down', () => {
    expect(isShuttingDown()).toBe(false);
  });

  it('returns true after setShuttingDown is called', () => {
    setShuttingDown();

    expect(isShuttingDown()).toBe(true);
  });

  it('resets to false after resetShuttingDown is called', () => {
    setShuttingDown();
    expect(isShuttingDown()).toBe(true);

    resetShuttingDown();
    expect(isShuttingDown()).toBe(false);
  });
});
