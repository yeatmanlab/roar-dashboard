import { describe, it, expect, expectTypeOf } from 'vitest';
import { startRun, abortRun } from './firekit';
import { SDKError } from '../errors/sdk-error';

describe('firekit compat', () => {
  describe('abortRun', () => {
    it('throws SdkError when called', () => {
      expect(() => abortRun()).toThrow(SDKError);
    });

    it('matches Firekit signature', () => {
      expect(typeof abortRun).toBe('function');
      expectTypeOf(abortRun).toEqualTypeOf<() => void>();
    });

    describe('startRun', () => {
      it('throws SDKError when called', async () => {
        await expect(startRun()).rejects.toBeInstanceOf(SDKError);
        await expect(startRun({ foo: 'bar' })).rejects.toBeInstanceOf(SDKError);
      });

      it('matches Firekit signature', () => {
        expect(typeof startRun).toBe('function');
        expectTypeOf(startRun).toEqualTypeOf<(additionalRunMetadata?: { [key: string]: string }) => Promise<void>>();
      });
    });
  });
});
