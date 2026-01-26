import { describe, it, expect, expectTypeOf } from 'vitest';
import { finishRun } from './firekit';
import { SDKError } from '../errors/sdk-error';

describe('firekit compat: finishRun', () => {
  it('throws SDKError when called', async () => {
    await expect(finishRun()).rejects.toBeInstanceOf(SDKError);
    await expect(finishRun({ foo: 'bar' })).rejects.toBeInstanceOf(SDKError);
  });

  it('matches Firekit signature', () => {
    // runtime assertion to satisfy vitest/expect-expect
    expect(typeof finishRun).toBe('function');

    // compile-time signature check
    expectTypeOf(finishRun).toEqualTypeOf<(finishingMetaData?: { [key: string]: unknown }) => Promise<void>>();
  });
});
