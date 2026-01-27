import { describe, it, expect, expectTypeOf } from 'vitest';
import { finishRun } from './firekit';
import { SDKError } from '../errors/sdk-error';

describe('firekit compat', () => {
  describe('finishRun', () => {
    it('throws SdkError when called', async () => {
      await expect(finishRun()).rejects.toBeInstanceOf(SDKError);
      await expect(finishRun({ foo: 'bar' })).rejects.toBeInstanceOf(SDKError);
    });

    it('matches Firekit signature', () => {
      expect(typeof finishRun).toBe('function');
      expectTypeOf(finishRun).toEqualTypeOf<(finishingMetaData?: { [key: string]: unknown }) => Promise<void>>();
    });
  });
});
