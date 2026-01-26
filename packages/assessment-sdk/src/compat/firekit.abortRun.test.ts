import { describe, it, expect, expectTypeOf } from 'vitest';
import { abortRun } from './firekit';
import { SDKError } from '../errors/sdk-error';

describe('firekit compat: abortRun', () => {
  it('throws SDKError when called', () => {
    expect(() => abortRun()).toThrow(SDKError);
  });

  it('matches Firekit signature', () => {
    // runtime assertion to satisfy vitest/expect-expect
    expect(typeof abortRun).toBe('function');

    // compile-time signature check
    expectTypeOf(abortRun).toEqualTypeOf<() => void>();
  });
});
