import { describe, it, expect, expectTypeOf } from 'vitest';
import { startRun } from './firekit';
import { SDKError } from '../errors/sdk-error';

describe('firekit compat: startRun', () => {
  it('throws SdkError when called', async () => {
    await expect(startRun()).rejects.toBeInstanceOf(SDKError);
    await expect(startRun({ foo: 'bar' })).rejects.toBeInstanceOf(SDKError);
  });

  it('matches Firekit signature', () => {
    // runtime assertion to satisfy vitest/expect-expect
    expect(typeof startRun).toBe('function');

    // compile-time signature check
    expectTypeOf(startRun).toEqualTypeOf<(additionalRunMetadata?: { [key: string]: string }) => Promise<void>>();
  });
});
