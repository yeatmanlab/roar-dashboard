import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { startRun, finishRun, abortRun, updateEngagementFlags, updateUser } from './firekit';
import { SDKError } from '../errors/sdk-error';
import type { UpdateEngagementFlagsInput, UpdateUserInput } from '../types';

describe('firekit compat', () => {
  describe('abortRun', () => {
    it('throws SdkError when called', () => {
      expect(() => abortRun()).toThrow(SDKError);
    });

    it('matches Firekit signature', () => {
      expect(typeof abortRun).toBe('function');
      expectTypeOf(abortRun).toEqualTypeOf<() => void>();
    });
  });

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
      await expect(updateEngagementFlags({ flagNames: ['flag1'] })).rejects.toBeInstanceOf(SDKError);
      await expect(
        updateEngagementFlags({ flagNames: ['flag1', 'flag2'], markAsReliable: true }),
      ).rejects.toBeInstanceOf(SDKError);
      await expect(
        updateEngagementFlags({ flagNames: ['flag1'], markAsReliable: false, reliableByBlock: { block1: true } }),
      ).rejects.toBeInstanceOf(SDKError);
    });

    it('matches Firekit signature', () => {
      // runtime assertion to satisfy vitest/expect-expect
      expect(typeof updateEngagementFlags).toBe('function');

      // compile-time signature check
      expectTypeOf(updateEngagementFlags).toEqualTypeOf<(input: UpdateEngagementFlagsInput) => Promise<void>>();
    });
  });

  describe('updateUser', () => {
    it('throws SDKError when called', async () => {
      await expect(updateUser({ assessmentPid: 'test-pid' })).rejects.toBeInstanceOf(SDKError);
      await expect(updateUser({ tasks: [], variants: [] })).rejects.toBeInstanceOf(SDKError);
      await expect(updateUser({ assessmentPid: 'test', customField: 'value' })).rejects.toBeInstanceOf(SDKError);
    });

    it('issues deprecation warning when called', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(updateUser({ assessmentPid: 'test-pid' })).rejects.toBeInstanceOf(SDKError);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'appkit.updateUser is deprecated and related to standalone apps. Consider using alternative methods.'
      );

      consoleWarnSpy.mockRestore();
    });

    it('matches Firekit signature', () => {
      // runtime assertion to satisfy vitest/expect-expect
      expect(typeof updateUser).toBe('function');

      // compile-time signature check
      expectTypeOf(updateUser).toEqualTypeOf<(userUpdateData: UpdateUserInput) => Promise<void>>();
    });
  });
});
