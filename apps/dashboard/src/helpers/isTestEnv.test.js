import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import isTestEnv from './isTestEnv';

describe('isTestEnv', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return false when __E2E__ is not set', () => {
    expect(isTestEnv()).toBe(false);
  });

  it('should return false when __E2E__ is set to a value other than "true"', () => {
    localStorage.setItem('__E2E__', 'false');
    expect(isTestEnv()).toBe(false);

    localStorage.setItem('__E2E__', '1');
    expect(isTestEnv()).toBe(false);

    localStorage.setItem('__E2E__', 'yes');
    expect(isTestEnv()).toBe(false);
  });

  it('should return true when __E2E__ is set to "true"', () => {
    localStorage.setItem('__E2E__', 'true');
    expect(isTestEnv()).toBe(true);
  });

  it('should return false after __E2E__ is removed', () => {
    localStorage.setItem('__E2E__', 'true');
    expect(isTestEnv()).toBe(true);

    localStorage.removeItem('__E2E__');
    expect(isTestEnv()).toBe(false);
  });
});
