import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { startRun, updateUser } from './firekit';
import { SDKError } from '../errors/sdk-error';
import type { UpdateUserInput } from '../types';

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

  describe('updateUser', () => {
    it('throws SDKError when called', async () => {
      await expect(updateUser({ assessmentPid: 'test-pid' })).rejects.toBeInstanceOf(SDKError);
      await expect(updateUser({ tasks: [], variants: [] })).rejects.toBeInstanceOf(SDKError);
      await expect(updateUser({ assessmentPid: 'test', customField: 'value' })).rejects.toBeInstanceOf(SDKError);
    });

    it('issues deprecation warning when called', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      try {
        await updateUser({ assessmentPid: 'test-pid' });
      } catch {
        // Expected to throw
      }

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
