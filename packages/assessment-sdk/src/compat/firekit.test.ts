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
  _resetFirekitCompat,
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
    let mockContext: CommandContext;

    beforeEach(() => {
      mockContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
      };
      initFirekitCompat(mockContext);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('returns immediately without error when no run is active', () => {
      expect(() => abortRun()).not.toThrow();
    });

    it('posts abort event to backend when run is active', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'run-123' }),
      });

      mockContext.fetchImpl = mockFetch as unknown as typeof fetch;
      initFirekitCompat(mockContext);

      _setTaskInfoForCompat({
        variantId: 'variant-123',
        version: '1.0.0',
        isAnonymous: true,
      });

      await startRun();

      // Reset mock to track abort call separately
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true });

      vi.useFakeTimers();
      try {
        abortRun();

        // Flush the fire-and-forget async operation deterministically
        await vi.runAllTimersAsync();
      } finally {
        vi.useRealTimers();
      }

      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toContain('/v1/runs/run-123/events');
      expect(call[1]?.method).toBe('POST');
      // Verify abort event type is sent
      const body = JSON.parse(call[1]?.body as string);
      expect(body.type).toBe('abort');
    });

    it('handles API errors gracefully without throwing', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'run-456' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });

      mockContext.fetchImpl = mockFetch as unknown as typeof fetch;
      initFirekitCompat(mockContext);

      _setTaskInfoForCompat({
        variantId: 'variant-123',
        version: '1.0.0',
        isAnonymous: true,
      });

      await startRun();

      // abortRun should not throw even if API fails
      expect(() => abortRun()).not.toThrow();
    });

    it('does not throw when run is active and API succeeds', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'run-success' }),
        })
        .mockResolvedValueOnce({
          ok: true,
        });

      mockContext.fetchImpl = mockFetch as unknown as typeof fetch;
      initFirekitCompat(mockContext);

      _setTaskInfoForCompat({
        variantId: 'variant-123',
        version: '1.0.0',
        isAnonymous: true,
      });

      await startRun();

      vi.useFakeTimers();
      try {
        // abortRun should not throw
        expect(() => abortRun()).not.toThrow();

        await vi.runAllTimersAsync();
      } finally {
        vi.useRealTimers();
      }

      // Verify abort event was posted
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const abortCall = mockFetch.mock.calls[1]!;
      expect(abortCall[0]).toContain('/v1/runs/run-success/events');
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
    });

    afterEach(() => {
      vi.clearAllMocks();
      _resetFirekitCompat();
    });

    it('throws SDKError when task info is not set', async () => {
      // Don't initialize - test against truly uninitialized state
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
        status: 201,
        json: async () => ({ data: { id: 'run-123' } }),
        headers: new Headers([['content-type', 'application/json']]),
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

    it('throws SDKError when Firekit compat is not initialized', async () => {
      // Don't call initFirekitCompat - simulate uninitialized state
      // This will cause getCtx() to throw the proper error
      await expect(startRun()).rejects.toBeInstanceOf(SDKError);
    });

    it('successfully starts an anonymous run', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({ data: { id: 'run-anon-123' } }),
        headers: new Headers([['content-type', 'application/json']]),
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
        status: 201,
        json: async () => ({ data: { id: 'run-non-anon-789' } }),
        headers: new Headers([['content-type', 'application/json']]),
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
        status: 201,
        json: async () => ({ data: { id: 'run-with-metadata' } }),
        headers: new Headers([['content-type', 'application/json']]),
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
