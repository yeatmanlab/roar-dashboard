import { describe, it, expect, expectTypeOf } from 'vitest';
import { startRun, updateEngagementFlags } from './firekit';
import { SDKError } from '../errors/sdk-error';

describe('firekit compat', () => {
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

  describe('updateEngagementFlags', () => {
    it('throws SDKError when called', async () => {
      await expect(updateEngagementFlags(['flag1'])).rejects.toBeInstanceOf(SDKError);
      await expect(updateEngagementFlags(['flag1', 'flag2'], true)).rejects.toBeInstanceOf(SDKError);
      await expect(updateEngagementFlags(['flag1'], false, { block: 1 })).rejects.toBeInstanceOf(SDKError);
    });

    it('matches Firekit signature', () => {
      // runtime assertion to satisfy vitest/expect-expect
      expect(typeof updateEngagementFlags).toBe('function');

      // compile-time signature check
      expectTypeOf(updateEngagementFlags).toEqualTypeOf<
        (flagNames: string[], markAsReliable?: boolean, reliableByBlock?: unknown) => Promise<void>
      >();
    });
  });
});
