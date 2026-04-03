import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
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
import type { AddInteractionInput, UpdateUserInput, TrialData, RawScores, ComputedScores } from '../types';
import type { CommandContext } from '../command/command';
import { RUN_EVENT_STATUS_OK } from '../types';

/**
 * Helper to create a mock CommandContext for testing.
 * Provides a standard test context with a mocked auth token provider.
 *
 * @returns A CommandContext configured for testing with localhost baseUrl
 */
function createMockContext(fetchImpl?: typeof fetch): CommandContext {
  return {
    baseUrl: 'http://localhost:3000',
    auth: {
      getToken: vi.fn().mockResolvedValue('test-token'),
    },
    ...(fetchImpl ? { fetchImpl } : {}),
  };
}

/**
 * Helper to set up a fetch mock that handles startRun and event endpoints.
 * Simulates the ROAR backend API responses for run creation and event posting.
 *
 * **Mocked endpoints:**
 * - POST /runs → Returns 201 CREATED with the provided runId
 * - POST /runs/:runId/event → Returns 200 OK with success status
 *
 * @param runId - The run ID to return for startRun requests
 * @returns A vitest mock function configured to handle run API calls
 */
function setupFetchMock(runId: string): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  fetchMock.mockImplementation((url: string | Request) => {
    // Extract URL string from Request object if needed
    const urlString = typeof url === 'string' ? url : url.url;

    // Return 200 OK for event endpoints (POST /runs/:runId/event) - check this first
    if (urlString.includes('/event')) {
      return Promise.resolve({
        status: StatusCodes.OK,
        json: async () => ({ data: { status: RUN_EVENT_STATUS_OK } }),
        headers: new Headers([['content-type', 'application/json']]),
      } as Response);
    }
    // Return 201 CREATED for startRun (POST /runs) - but not for /event
    if (urlString.includes('/runs') && !urlString.includes('/event')) {
      return Promise.resolve({
        status: StatusCodes.CREATED,
        json: async () => ({ data: { id: runId } }),
        headers: new Headers([['content-type', 'application/json']]),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch call: ${urlString}`));
  });
  return fetchMock;
}

/**
 * Helper to initialize firekit compat with a mock context and fetch mock.
 * Reduces boilerplate in tests by combining context creation, fetch setup, and initialization.
 *
 * **Usage:**
 * ```ts
 * const { fetchMock } = initializeFirekit('run-123');
 * await startRun();
 * expect(fetchMock).toHaveBeenCalled();
 * ```
 *
 * @param runId - The run ID to return for startRun requests
 * @param options - Optional configuration for the run (isAnonymous, administrationId)
 * @returns Object containing the mock context and fetch mock for assertions
 */
function initializeFirekit(
  runId: string,
  options: { isAnonymous?: boolean; administrationId?: string } = {},
): { mockContext: CommandContext; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = setupFetchMock(runId);
  vi.stubGlobal('fetch', fetchMock);
  const mockContext = createMockContext();

  initFirekitCompat(mockContext, {
    variantId: 'variant-123',
    taskVersion: '1.0.0',
    isAnonymous: options.isAnonymous ?? true,
    ...(options.administrationId && { administrationId: options.administrationId }),
  });

  return { mockContext, fetchMock };
}

/**
 * Helper to initialize firekit compat and start a run in one call.
 * Eliminates repetitive setup in tests that need an active run.
 *
 * **Usage:**
 * ```ts
 * const { fetchMock } = await initializeFirekitAndStartRun('run-123');
 * await writeTrial(trialData);
 * expect(fetchMock).toHaveBeenCalled();
 * ```
 *
 * @param runId - The run ID to return for startRun requests
 * @param options - Optional configuration for the run (isAnonymous, administrationId)
 * @returns Object containing the mock context and fetch mock for assertions
 */
async function initializeFirekitAndStartRun(
  runId: string,
  options: { isAnonymous?: boolean; administrationId?: string } = {},
): Promise<{ mockContext: CommandContext; fetchMock: ReturnType<typeof vi.fn> }> {
  const { mockContext, fetchMock } = initializeFirekit(runId, options);
  await startRun();
  return { mockContext, fetchMock };
}

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
      const { fetchMock } = initializeFirekit('run-abort-test');

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
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      _resetFirekitCompat();
    });

    it('throws SDKError when called without an active run', async () => {
      await expect(finishRun()).rejects.toBeInstanceOf(SDKError);
      await expect(finishRun({ foo: 'bar' })).rejects.toBeInstanceOf(SDKError);
    });

    it('successfully finishes an active run', async () => {
      const { fetchMock } = initializeFirekit('run-finish-test');

      await startRun();
      await expect(finishRun()).resolves.toBeUndefined();

      // Verify fetch was called with the finish event endpoint
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/runs/run-finish-test/event'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('complete'),
        }),
      );

      // Verify runId is cleared after successful finish to prevent stale state
      const facade = getFirekitCompat();
      expect(facade._getRunId()).toBeUndefined();
    });

    it('includes metadata when provided', async () => {
      const { fetchMock } = initializeFirekit('run-finish-metadata');

      await startRun();
      await expect(finishRun({ customField: 'value', count: 42 })).resolves.toBeUndefined();

      // Verify metadata was included in the request
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/runs/run-finish-metadata/event'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('customField'),
        }),
      );
    });

    it('matches Firekit signature', () => {
      expect(typeof finishRun).toBe('function');
      expectTypeOf(finishRun).toEqualTypeOf<(finishingMetaData?: { [key: string]: unknown }) => Promise<void>>();
    });
  });

  describe('startRun', () => {
    afterEach(() => {
      vi.clearAllMocks();
      _resetFirekitCompat();
    });

    it('throws SDKError when administrationId is required but missing (isAnonymous=false)', async () => {
      const mockContext = createMockContext();
      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: false,
      });

      await expect(startRun()).rejects.toThrow('appkit.startRun requires administrationId when isAnonymous is false.');
    });

    it('resets facade instance state on re-initialization (prevents state leakage)', async () => {
      let callCount = 0;
      const mockContext = createMockContext();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            status: StatusCodes.CREATED,
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
      initializeFirekit('run-anon-123');
      await expect(startRun()).resolves.toBeUndefined();
    });

    it('successfully starts a non-anonymous run with administrationId (isAnonymous=false)', async () => {
      initializeFirekit('run-non-anon-789', { isAnonymous: false, administrationId: 'admin-456' });
      await expect(startRun()).resolves.toBeUndefined();
    });

    it('includes additional metadata when provided (custom key-value pairs)', async () => {
      initializeFirekit('run-with-metadata');
      const additionalMetadata = { customField: 'value', count: 42 };
      await expect(startRun(additionalMetadata)).resolves.toBeUndefined();
    });

    it('matches Firekit signature (with optional metadata)', () => {
      expect(typeof startRun).toBe('function');
      expectTypeOf(startRun).toEqualTypeOf<(additionalRunMetadata?: Record<string, unknown>) => Promise<void>>();
    });
  });

  describe('updateEngagementFlags', () => {
    /**
     * Test suite for the updateEngagementFlags Firekit compatibility function.
     *
     * Tests the function's ability to:
     * - Throw SDKError when no active run exists
     * - Send engagement flags to the backend when a run is active
     * - Handle the optional markAsReliable parameter
     * - Match the expected Firekit function signature
     */

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      _resetFirekitCompat();
    });

    it('throws SDKError when no active run', async () => {
      await expect(updateEngagementFlags(['incomplete'])).rejects.toBeInstanceOf(SDKError);
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
      beforeEach(() => {
        vi.clearAllMocks();
      });

      afterEach(() => {
        _resetFirekitCompat();
      });

      it('throws SDKError when called without an active run', async () => {
        const trialData: TrialData = { response: 'correct', rt: 500 };
        await expect(writeTrial(trialData)).rejects.toBeInstanceOf(SDKError);
      });

      it('throws SDKError when called with callback but no active run', async () => {
        const trialData: TrialData = { response: 'correct', rt: 500 };
        const callback = async (rawScores: RawScores): Promise<ComputedScores> => {
          return { computed: rawScores };
        };
        await expect(writeTrial(trialData, callback)).rejects.toBeInstanceOf(SDKError);
      });

      it('successfully submits trial data when run is active', async () => {
        const { fetchMock } = await initializeFirekitAndStartRun('run-trial-test');

        const trialData: TrialData = {
          assessmentStage: 'test',
          correct: 1,
          response: 'A',
          rt: 1500,
        };

        await expect(writeTrial(trialData)).resolves.toBeUndefined();

        // Verify fetch was called with the trial event endpoint
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/runs/run-trial-test/event'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('trial'),
          }),
        );
      });

      it('accepts optional computed score callback', async () => {
        await initializeFirekitAndStartRun('run-trial-callback');

        const trialData: TrialData = {
          assessmentStage: 'test',
          correct: 1,
          response: 'correct',
          rt: 500,
        };
        const callback = async (rawScores: RawScores): Promise<ComputedScores> => {
          return { computed: rawScores };
        };

        await expect(writeTrial(trialData, callback)).resolves.toBeUndefined();
      });

      it('coerces boolean correct: true to 1', async () => {
        const { fetchMock } = await initializeFirekitAndStartRun('run-bool-true');

        const trialDataWithBooleanCorrect: TrialData = {
          assessmentStage: 'test',
          correct: true,
          response: 'A',
          rt: 1500,
        };

        await expect(writeTrial(trialDataWithBooleanCorrect)).resolves.toBeUndefined();

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/runs/run-bool-true/event'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"correct":1'),
          }),
        );
      });

      it('coerces boolean correct: false to 0', async () => {
        const { fetchMock } = await initializeFirekitAndStartRun('run-bool-false');

        const trialDataWithBooleanCorrect: TrialData = {
          assessmentStage: 'test',
          correct: false,
          response: 'B',
          rt: 1500,
        };

        await expect(writeTrial(trialDataWithBooleanCorrect)).resolves.toBeUndefined();

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/runs/run-bool-false/event'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"correct":0'),
          }),
        );
      });

      it('allows multiple trials to be written in sequence without clearing runId', async () => {
        const { fetchMock } = await initializeFirekitAndStartRun('run-multi-trial');

        const firstTrial: TrialData = {
          assessmentStage: 'test',
          correct: 1,
          response: 'A',
          rt: 1500,
        };

        const secondTrial: TrialData = {
          assessmentStage: 'test',
          correct: 0,
          response: 'B',
          rt: 2000,
        };

        await expect(writeTrial(firstTrial)).resolves.toBeUndefined();
        await expect(writeTrial(secondTrial)).resolves.toBeUndefined();

        expect(fetchMock).toHaveBeenCalledTimes(3);
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

    describe('addInteraction', () => {
      const mockContext: CommandContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
      };

      beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal(
          'fetch',
          vi.fn().mockImplementation((url: string | Request) => {
            const urlString = typeof url === 'string' ? url : url.url;
            if (urlString.includes('/runs') && !urlString.includes('/event')) {
              return Promise.resolve({
                status: StatusCodes.CREATED,
                json: async () => ({ data: { id: 'run-interaction-test' } }),
                headers: new Headers([['content-type', 'application/json']]),
              });
            }
            if (urlString.includes('/event')) {
              return Promise.resolve({
                status: StatusCodes.OK,
                json: async () => ({ data: { status: RUN_EVENT_STATUS_OK } }),
                headers: new Headers([['content-type', 'application/json']]),
              });
            }
            return Promise.reject(new Error('Unexpected fetch call'));
          }),
        );
        initFirekitCompat(mockContext, {
          variantId: 'variant-123',
          taskVersion: '1.0.0',
          isAnonymous: true,
        });
      });

      afterEach(() => {
        _resetFirekitCompat();
      });

      it('throws SDKError when called before initFirekitCompat', () => {
        _resetFirekitCompat();
        expect(() => addInteraction({ event: 'focus', time: 100 })).toThrow(SDKError);
      });

      it('throws SDKError when called before startRun', () => {
        // beforeEach leaves us initialized but without a run
        expect(() => addInteraction({ event: 'focus', time: 100 })).toThrow(SDKError);
      });

      it('buffers interaction events', async () => {
        await startRun();
        const interaction: AddInteractionInput = { event: 'focus', time: 100 };
        expect(() => addInteraction(interaction)).not.toThrow();
      });

      it('accumulates multiple interactions in buffer', async () => {
        const fetchMock = vi.fn().mockImplementation((url: string | Request) => {
          const urlString = typeof url === 'string' ? url : url.url;
          if (urlString.includes('/runs') && !urlString.includes('/event')) {
            return Promise.resolve({
              status: StatusCodes.CREATED,
              json: async () => ({ data: { id: 'run-accumulate' } }),
              headers: new Headers([['content-type', 'application/json']]),
            });
          }
          if (urlString.includes('/event')) {
            return Promise.resolve({
              status: StatusCodes.OK,
              json: async () => ({ data: { status: RUN_EVENT_STATUS_OK } }),
              headers: new Headers([['content-type', 'application/json']]),
            });
          }
          return Promise.reject(new Error('Unexpected fetch call'));
        });

        vi.stubGlobal('fetch', fetchMock);

        await startRun();
        addInteraction({ event: 'focus', time: 100 });
        addInteraction({ event: 'blur', time: 200 });
        addInteraction({ event: 'fullscreenenter', time: 300 });
        addInteraction({ event: 'fullscreenexit', time: 400 });

        const trialData: TrialData = {
          assessmentStage: 'test',
          correct: 1,
          response: 'A',
          rt: 500,
        };

        await writeTrial(trialData);

        // Verify all 4 interactions were sent in the writeTrial call
        const eventCalls = fetchMock.mock.calls.filter((call) => call[0].includes('/event'));
        expect(eventCalls).toHaveLength(1);
        const body = JSON.parse(eventCalls[0]![1].body as string);
        expect(body.interactions).toHaveLength(4);
        expect(body.interactions[0]!.event).toBe('focus');
        expect(body.interactions[1]!.event).toBe('blur');
        expect(body.interactions[2]!.event).toBe('fullscreen_enter');
        expect(body.interactions[3]!.event).toBe('fullscreen_exit');
      });

      it('clears buffer after writeTrial', async () => {
        const fetchMock = vi.fn().mockImplementation((url: string | Request) => {
          const urlString = typeof url === 'string' ? url : url.url;
          if (urlString.includes('/runs') && !urlString.includes('/event')) {
            return Promise.resolve({
              status: StatusCodes.CREATED,
              json: async () => ({ data: { id: 'run-buffer-clear' } }),
              headers: new Headers([['content-type', 'application/json']]),
            });
          }
          if (urlString.includes('/event')) {
            return Promise.resolve({
              status: StatusCodes.OK,
              json: async () => ({ data: { status: RUN_EVENT_STATUS_OK } }),
              headers: new Headers([['content-type', 'application/json']]),
            });
          }
          return Promise.reject(new Error('Unexpected fetch call'));
        });

        vi.stubGlobal('fetch', fetchMock);

        await startRun();

        addInteraction({ event: 'focus', time: 100 });
        addInteraction({ event: 'blur', time: 200 });

        const trialData: TrialData = {
          assessmentStage: 'test',
          correct: 1,
          response: 'A',
          rt: 500,
        };

        await writeTrial(trialData);

        addInteraction({ event: 'fullscreenenter', time: 300 });
        await expect(writeTrial(trialData)).resolves.toBeUndefined();

        // Verify second call only sent 1 interaction (buffer was cleared)
        const eventCalls = fetchMock.mock.calls.filter((call) => call[0].includes('/event'));
        expect(eventCalls).toHaveLength(2);
        const secondBody = JSON.parse(eventCalls[1]![1].body as string);
        expect(secondBody.interactions).toHaveLength(1);
      });

      it('restores interactions to buffer if writeTrial fails', async () => {
        let callCount = 0;
        const fetchMock = vi.fn().mockImplementation((url: string | Request) => {
          const urlString = typeof url === 'string' ? url : url.url;
          if (urlString.includes('/runs') && !urlString.includes('/event')) {
            return Promise.resolve({
              status: StatusCodes.CREATED,
              json: async () => ({ data: { id: 'run-buffer-restore' } }),
              headers: new Headers([['content-type', 'application/json']]),
            });
          }
          if (urlString.includes('/event')) {
            callCount++;
            // First call fails, second call succeeds
            if (callCount === 1) {
              return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve({
              status: StatusCodes.OK,
              json: async () => ({ data: { status: RUN_EVENT_STATUS_OK } }),
              headers: new Headers([['content-type', 'application/json']]),
            });
          }
          return Promise.reject(new Error('Unexpected fetch call'));
        });

        vi.stubGlobal('fetch', fetchMock);

        await startRun();

        addInteraction({ event: 'focus', time: 100 });
        addInteraction({ event: 'blur', time: 200 });

        const trialData: TrialData = {
          assessmentStage: 'test',
          correct: 1,
          response: 'A',
          rt: 500,
        };

        // First writeTrial call fails
        await expect(writeTrial(trialData)).rejects.toThrow();

        // Add another interaction after the failure
        addInteraction({ event: 'fullscreenenter', time: 300 });

        // Second writeTrial call should succeed and include all 3 interactions
        // (the 2 from before + 1 new, since the first 2 were restored to buffer)
        await expect(writeTrial(trialData)).resolves.toBeUndefined();

        // Verify second call sent all 3 interactions (buffer was restored after failure)
        const eventCalls = fetchMock.mock.calls.filter((call) => call[0].includes('/event'));
        expect(eventCalls).toHaveLength(2);
        const secondBody = JSON.parse(eventCalls[1]![1].body as string);
        expect(secondBody.interactions).toHaveLength(3);
        expect(secondBody.interactions[0]!.event).toBe('focus');
        expect(secondBody.interactions[1]!.event).toBe('blur');
        expect(secondBody.interactions[2]!.event).toBe('fullscreen_enter');
      });

      it('matches Firekit signature', () => {
        expect(typeof addInteraction).toBe('function');

        expectTypeOf(addInteraction).toEqualTypeOf<(interaction: AddInteractionInput) => void>();
      });
    });
  });
});
