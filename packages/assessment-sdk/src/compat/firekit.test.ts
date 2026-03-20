import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import {
  startRun,
  finishRun,
  abortRun,
  updateEngagementFlags,
  addInteraction,
  updateUser,
  writeTrial,
  initFirekitCompat,
  getFirekitCompat,
  _resetFirekitCompat,
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
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      _resetFirekitCompat();
    });

    it('is a no-op when no active run (preserves Firekit behavior)', () => {
      expect(() => abortRun()).not.toThrow();
    });

    it('issues best-effort async abort request when run is active', async () => {
      const mockContext: CommandContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
      };

      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string) => {
        // Return 201 for startRun (POST /runs)
        if (url.includes('/runs') && !url.includes('/event')) {
          return Promise.resolve({
            status: 201,
            json: async () => ({ data: { id: 'run-abort-test' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
        // Return 200 for abortRun (POST /runs/:runId/event)
        if (url.includes('/event')) {
          return Promise.resolve({
            status: 200,
            json: async () => ({ data: { status: 'ok' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
        return Promise.reject(new Error('Unexpected fetch call'));
      });

      vi.stubGlobal('fetch', fetchMock);

      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      await startRun();

      expect(() => abortRun()).not.toThrow();

      // Wait a tick for the async abort to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify fetch was called with the abort event endpoint
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/runs/run-abort-test/event'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('abort'),
        }),
      );

      // Verify runId is cleared after successful abort
      const facade = getFirekitCompat();
      expect(facade._getRunId()).toBeUndefined();
    });

    it('matches Firekit signature', () => {
      expect(typeof abortRun).toBe('function');
      expectTypeOf(abortRun).toEqualTypeOf<() => void>();
    });
  });

  describe('finishRun', () => {
    it('throws SDKError when called (stub not yet implemented)', async () => {
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

    it('throws SDKError when administrationId is required but missing (isAnonymous=false)', async () => {
      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: false,
      });

      await expect(startRun()).rejects.toThrow('appkit.startRun requires administrationId when isAnonymous is false.');
    });

    it('resets facade instance state on re-initialization (prevents state leakage)', async () => {
      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            status: 201,
            json: async () => ({ data: { id: `run-${callCount}` } }),
            headers: new Headers([['content-type', 'application/json']]),
          };
        }),
      );

      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      await startRun();

      // Re-initialize should reset state to prevent leakage across tests/consumers
      // This is observable through the fact that a fresh startRun() call succeeds
      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      // After re-initialization, startRun should succeed again without errors
      await expect(startRun()).resolves.toBeUndefined();
    });

    it('throws SDKError when Firekit compat is not initialized (no task info)', async () => {
      // Don't call initFirekitCompat - simulate uninitialized state
      // Throws because taskInfo is null - facade was never initialized
      await expect(startRun()).rejects.toBeInstanceOf(SDKError);
    });

    it('successfully starts an anonymous run (isAnonymous=true)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          status: 201,
          json: async () => ({ data: { id: 'run-anon-123' } }),
          headers: new Headers([['content-type', 'application/json']]),
        }),
      );

      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      await expect(startRun()).resolves.toBeUndefined();
    });

    it('successfully starts a non-anonymous run with administrationId (isAnonymous=false)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          status: 201,
          json: async () => ({ data: { id: 'run-non-anon-789' } }),
          headers: new Headers([['content-type', 'application/json']]),
        }),
      );

      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        administrationId: 'admin-456',
        isAnonymous: false,
      });

      await expect(startRun()).resolves.toBeUndefined();
    });

    it('includes additional metadata when provided (custom key-value pairs)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          status: 201,
          json: async () => ({ data: { id: 'run-with-metadata' } }),
          headers: new Headers([['content-type', 'application/json']]),
        }),
      );

      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      const additionalMetadata = { customField: 'value', count: 42 };
      await expect(startRun(additionalMetadata)).resolves.toBeUndefined();
    });

    it('matches Firekit signature (with optional metadata)', () => {
      expect(typeof startRun).toBe('function');
      expectTypeOf(startRun).toEqualTypeOf<(additionalRunMetadata?: Record<string, unknown>) => Promise<void>>();
    });
  });

  describe('updateEngagementFlags', () => {
    it('throws SDKError when called (stub not yet implemented)', async () => {
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
    it('throws SDKError when called (stub not yet implemented)', () => {
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
    it('throws SDKError when called (stub not yet implemented)', async () => {
      await expect(updateUser({ assessmentPid: 'test-pid' })).rejects.toBeInstanceOf(SDKError);
      await expect(updateUser({ tasks: [], variants: [] })).rejects.toBeInstanceOf(SDKError);
      await expect(updateUser({ assessmentPid: 'test', metadata: { customField: 'value' } })).rejects.toBeInstanceOf(
        SDKError,
      );
    });

    it('issues deprecation warning when called (related to standalone apps)', async () => {
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
    it('throws SDKError when called (stub not yet implemented)', async () => {
      const trialData: TrialData = { response: 'correct', rt: 500 };
      await expect(writeTrial(trialData)).rejects.toBeInstanceOf(SDKError);

      const callback = async (rawScores: RawScores): Promise<ComputedScores> => {
        return { computed: rawScores };
      };
      await expect(writeTrial(trialData, callback)).rejects.toBeInstanceOf(SDKError);
    });

    it('matches Firekit signature (with optional computed score callback)', () => {
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
