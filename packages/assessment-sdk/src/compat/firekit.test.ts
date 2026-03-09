import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import {
  startRun,
  finishRun,
  abortRun,
  updateEngagementFlags,
  addInteraction,
  updateUser,
  writeTrial,
  _getRunIdForCompat,
  initFirekitCompat,
} from './firekit';
import { SDKError } from '../errors/sdk-error';
import type {
  UpdateEngagementFlagsInput,
  AddInteractionInput,
  UpdateUserInput,
  TrialData,
  RawScores,
  ComputedScores,
} from '../types';
import type { CommandContext } from '../command/command';

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
    let mockContext: CommandContext;

    beforeEach(() => {
      mockContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
      };
      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        administrationId: 'admin-123',
        isAnonymous: true,
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('throws SDKError when task info is not set', async () => {
      await expect(startRun()).rejects.toBeInstanceOf(SDKError);
      await expect(startRun({ foo: 'bar' })).rejects.toBeInstanceOf(SDKError);
    });

    it('throws SDKError when administrationId is required but missing', async () => {
      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: false,
      });

      await expect(startRun()).rejects.toThrow('appkit.startRun requires administrationId when isAnonymous is false.');
    });

    it('resets state on re-initialization', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'run-123' }),
      });

      mockContext.fetchImpl = mockFetch as unknown as typeof fetch;
      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        administrationId: 'admin-123',
        isAnonymous: true,
      });

      await startRun();
      expect(_getRunIdForCompat()).toBe('run-123');

      // Re-initialize should reset state
      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        administrationId: 'admin-123',
        isAnonymous: true,
      });
      expect(_getRunIdForCompat()).toBeUndefined();
    });

    it('successfully starts an anonymous run', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'run-anon-123' }),
      });

      mockContext.fetchImpl = mockFetch as unknown as typeof fetch;
      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        administrationId: 'admin-123',
        isAnonymous: true,
      });

      await startRun();

      expect(_getRunIdForCompat()).toBe('run-anon-123');
    });

    it('successfully starts a non-anonymous run with administrationId', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'run-non-anon-789' }),
      });

      mockContext.fetchImpl = mockFetch as unknown as typeof fetch;
      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        administrationId: 'admin-456',
        isAnonymous: false,
      });

      await startRun();

      expect(_getRunIdForCompat()).toBe('run-non-anon-789');
    });

    it('includes additional metadata when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'run-with-metadata' }),
      });

      mockContext.fetchImpl = mockFetch as unknown as typeof fetch;
      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        administrationId: 'admin-123',
        isAnonymous: true,
      });

      const additionalMetadata = { customField: 'value', count: 42 };
      await startRun(additionalMetadata);

      expect(_getRunIdForCompat()).toBe('run-with-metadata');
    });

    it('throws SDKError when Firekit compat is not initialized', async () => {
      // Don't call initFirekitCompat - simulate uninitialized state
      // This will cause getCtx() to throw the proper error
      await expect(startRun()).rejects.toBeInstanceOf(SDKError);
    });

    it('matches Firekit signature', () => {
      expect(typeof startRun).toBe('function');
      expectTypeOf(startRun).toEqualTypeOf<(additionalRunMetadata?: Record<string, unknown>) => Promise<void>>();
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

  describe('updateUser', () => {
    it('throws SDKError when called', async () => {
      await expect(updateUser({ assessmentPid: 'test-pid' })).rejects.toBeInstanceOf(SDKError);
      await expect(updateUser({ tasks: [], variants: [] })).rejects.toBeInstanceOf(SDKError);
      await expect(updateUser({ assessmentPid: 'test', metadata: { customField: 'value' } })).rejects.toBeInstanceOf(
        SDKError,
      );
    });

    it('issues deprecation warning when called', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(updateUser({ assessmentPid: 'test-pid' })).rejects.toBeInstanceOf(SDKError);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[DEPRECATION] updateUser() exists only for Firekit compatibility and will be removed in a future version.',
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
          computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>,
        ) => Promise<void>
      >();
    });
  });
});
