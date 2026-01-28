import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { startRun, updateUser, writeTrial } from './firekit';
import { SDKError } from '../errors/sdk-error';
import type { UpdateUserInput, TrialData, RawScores, ComputedScores } from '../types';

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

  describe('writeTrial', () => {
    it('throws SDKError when called', async () => {
      const trialData: TrialData = { response: 'correct', rt: 500 };
      await expect(writeTrial(trialData)).rejects.toBeInstanceOf(SDKError);
      
      const callback = async (rawScores: RawScores): Promise<ComputedScores> => {
        return { computed: rawScores };
      };
      await expect(writeTrial(trialData, callback)).rejects.toBeInstanceOf(SDKError);
    });

    it('matches Firekit signature', () => {
      // runtime assertion to satisfy vitest/expect-expect
      expect(typeof writeTrial).toBe('function');

      // compile-time signature check
      expectTypeOf(writeTrial).toEqualTypeOf<
        (
          trialData: TrialData,
          computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>
        ) => Promise<void>
      >();
    });
  });
});
