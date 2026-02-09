import { describe, it, expect, expectTypeOf } from 'vitest';
import { startRun, finishRun, abortRun, updateEngagementFlags, addInteraction, writeTrial } from './firekit';
import { SDKError } from '../errors/sdk-error';
import type { UpdateEngagementFlagsInput, AddInteractionInput, TrialData, RawScores, ComputedScores } from '../types';

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

  describe('addInteraction', () => {
    it('throws SDKError when called', () => {
      expect(() => addInteraction({ type: 'click' })).toThrow(SDKError);
      expect(() => addInteraction({ foo: 'bar' })).toThrow(SDKError);
    });

    it('matches Firekit signature', () => {
      // runtime assertion to satisfy vitest/expect-expect
      expect(typeof addInteraction).toBe('function');

      // compile-time signature check
      expectTypeOf(addInteraction).toEqualTypeOf<(interaction: AddInteractionInput) => void>();
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
          computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>,
        ) => Promise<void>
      >();
    });
  });
});
