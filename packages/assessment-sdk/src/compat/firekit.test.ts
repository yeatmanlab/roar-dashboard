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
  uploadFile,
  getVariantParamsById,
  initFirekitCompat,
  getFirekitCompat,
  _resetFirekitCompat,
} from './firekit';
import { uploadBytesResumable, getStorage, connectStorageEmulator } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';
import { getApp } from 'firebase/app';

vi.mock('firebase/storage', () => ({
  ref: vi.fn().mockReturnValue({ toString: () => 'gs://mock-bucket/path/to/file.webm' }),
  uploadBytesResumable: vi.fn().mockReturnValue({ on: vi.fn() }),
  getStorage: vi.fn().mockReturnValue({ _mockStorage: true }),
  connectStorageEmulator: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn().mockReturnValue({ options: { projectId: 'gse-roar-admin-staging' } }),
}));
import { SDKError } from '../errors/sdk-error';
import type { AddInteractionInput, UpdateUserInput, TrialData, RawScores, ComputedScores } from '../types';
import type { CommandContext } from '../command/command';
import { RUN_EVENT_STATUS_OK } from '../types';
import { UploadStatusEnum } from '../types/upload-file';
import type { UploadFileOutput } from '../types/upload-file';

/**
 * Helper to create a mock CommandContext for testing.
 * Provides a standard test context with a mocked auth token provider and participant ID.
 *
 * @returns A CommandContext configured for testing with localhost baseUrl and participantId
 */
function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function createMockContext(fetchImpl?: typeof fetch): CommandContext {
  return {
    baseUrl: 'http://localhost:3000',
    auth: {
      getToken: vi.fn().mockResolvedValue('test-token'),
    },
    participant: {
      participantId: 'participant-123',
    },
    logger: createMockLogger(),
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
    const urlString = typeof url === 'string' ? url : (url as { url?: string }).url || '';

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

    it('sends engagement flags to backend when run is active', async () => {
      const mockContext: CommandContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
        participant: {
          participantId: 'participant-123',
        },
      };

      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/runs') && !url.includes('/event')) {
          return Promise.resolve({
            status: StatusCodes.CREATED,
            json: async () => ({ data: { id: 'run-engagement-test' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
        if (url.includes('/event')) {
          return Promise.resolve({
            status: StatusCodes.OK,
            json: async () => ({ data: { status: RUN_EVENT_STATUS_OK } }),
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
      await updateEngagementFlags(['incomplete', 'response_time_too_fast']);

      const calls = fetchMock.mock.calls;
      const eventCall = calls.find((call) => call[0].includes('/event'));
      expect(eventCall).toBeDefined();

      const body = JSON.parse(eventCall![1].body as string);
      expect(body.type).toBe('engagement');
      expect(body.engagementFlags).toEqual({
        incomplete: true,
        responseTimeTooFast: true,
      });
      expect(body.reliableRun).toBe(false);
      expect(body.engagementFlags.incomplete).toBe(true);
      expect(body.engagementFlags.responseTimeTooFast).toBe(true);
    });

    it('sends engagement flags with markAsReliable when provided', async () => {
      const mockContext: CommandContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
        participant: {
          participantId: 'participant-123',
        },
      };

      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/runs') && !url.includes('/event')) {
          return Promise.resolve({
            status: StatusCodes.CREATED,
            json: async () => ({ data: { id: 'run-reliable-test' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
        if (url.includes('/event')) {
          return Promise.resolve({
            status: StatusCodes.OK,
            json: async () => ({ data: { status: RUN_EVENT_STATUS_OK } }),
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
      await updateEngagementFlags(['incomplete'], true);

      const calls = fetchMock.mock.calls;
      const eventCall = calls.find((call) => call[0].includes('/event'));
      expect(eventCall).toBeDefined();

      const body = JSON.parse(eventCall![1].body as string);
      expect(body.type).toBe('engagement');
      expect(body.engagementFlags).toEqual({
        incomplete: true,
      });
      expect(body.reliableRun).toBe(true);
    });

    it('preserves run ID after updating engagement flags', async () => {
      const mockContext: CommandContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
        participant: {
          participantId: 'participant-123',
        },
      };

      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/runs') && !url.includes('/event')) {
          return Promise.resolve({
            status: StatusCodes.CREATED,
            json: async () => ({ data: { id: 'run-preserve-id' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
        if (url.includes('/event')) {
          return Promise.resolve({
            status: StatusCodes.OK,
            json: async () => ({ data: { status: RUN_EVENT_STATUS_OK } }),
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
      await updateEngagementFlags(['incomplete']);

      const trialData: TrialData = {
        assessmentStage: 'test',
        correct: 1,
        response: 'A',
        rt: 500,
      };

      await expect(writeTrial(trialData)).resolves.toBeUndefined();

      const calls = fetchMock.mock.calls;
      const eventCalls = calls.filter((call) => call[0].includes('/event'));
      expect(eventCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('matches Firekit signature', () => {
      expect(typeof updateEngagementFlags).toBe('function');
      expectTypeOf(updateEngagementFlags).toEqualTypeOf<
        (flagNames: string[], markAsReliable?: boolean) => Promise<void>
      >();
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
      // NOTE: This test uses a stub callback, not the actual RoarScores.computedScoreCallback
      // from apps/assessments/roar-pa/src/experiment/scores.js.
      //
      // Architectural constraint: assessment-schema cannot depend on roar-pa to avoid
      // coupling the shared schema package to a specific assessment implementation.
      //
      // Drift detection: If RoarScores.computedScoreCallback changes its output shape
      // (e.g., adds/removes fields, changes field names), this will be caught by:
      // 1. Integration tests in roar-api.integration.test.ts that exercise the real
      //    scoring path end-to-end (real RoarScores → toPaScoreEntries → backend)
      // 2. The compile-time type check in score-entries.ts that ensures
      //    ComputedScoreEntry remains compatible with api-contract's ScoreEntry
      // 3. Runtime validation in pa-firekit-facade.js with strict: true mode
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

    it('accepts snake_case assessment_stage for backward compatibility', async () => {
      const { fetchMock } = await initializeFirekitAndStartRun('run-snake-case');

      const trialData: TrialData = {
        assessment_stage: 'test',
        correct: 1,
        response: 'A',
        rt: 1500,
      };

      await expect(writeTrial(trialData)).resolves.toBeUndefined();

      // Verify fetch was called with the trial event endpoint
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/runs/run-snake-case/event'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('trial'),
        }),
      );
    });

    it('prefers camelCase assessmentStage over snake_case assessment_stage when both present', async () => {
      const { fetchMock } = await initializeFirekitAndStartRun('run-both-formats');

      const trialData: TrialData = {
        assessmentStage: 'test',
        assessment_stage: 'practice', // Should be ignored
        correct: 1,
        response: 'A',
        rt: 1500,
      };

      await expect(writeTrial(trialData)).resolves.toBeUndefined();

      // Verify the request body contains 'test' (camelCase value), not 'practice' (snake_case value)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/runs/run-both-formats/event'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"assessmentStage":"test"'),
        }),
      );
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

    it('accumulates raw scores and produces scores array when facade methods are wired', async () => {
      const { fetchMock } = await initializeFirekitAndStartRun('run-computed-scores');

      const facade = getFirekitCompat();

      // Track if accumulation was called
      let accumulationCalled = false;
      let callbackCalled = false;

      // Wire the facade methods to accumulate raw scores and return scores
      // @NOTE: The stage level is typed as a concrete struct (not Record<string, number>) so that
      // `numCorrect` / `numAttempted` reads are known to exist under noUncheckedIndexedAccess.
      const accumulatedRawScores: Record<string, Record<string, { numCorrect: number; numAttempted: number }>> = {};

      facade._accumulateRawScore = (subtask: string, stage: string, correct: number) => {
        accumulationCalled = true;
        if (!accumulatedRawScores[subtask]) {
          accumulatedRawScores[subtask] = {
            practice: { numCorrect: 0, numAttempted: 0 },
            test: { numCorrect: 0, numAttempted: 0 },
          };
        }
        const stageScores = accumulatedRawScores[subtask]![stage]!;
        stageScores.numAttempted += 1;
        if (correct === 1) {
          stageScores.numCorrect += 1;
        }
      };

      facade._getRawScores = () => {
        return Object.keys(accumulatedRawScores).length > 0 ? (accumulatedRawScores as RawScores) : undefined;
      };

      facade._getScoreAdapter = () => {
        return (scores: ComputedScores) => {
          // Mock adapter that converts computed scores to ScoreEntry array
          const scoresRecord = scores as Record<string, unknown>;
          return [
            {
              type: 'computed',
              domain: 'test-domain',
              name: 'testScore',
              value: String(scoresRecord.testScore),
            },
          ];
        };
      };

      // Write a trial with subtask and stage
      const trialData: TrialData = {
        subtask: 'fsm',
        assessmentStage: 'test',
        correct: 1,
        response: 'A',
        rt: 1500,
      };

      const callback = async (rawScores: RawScores): Promise<ComputedScores> => {
        callbackCalled = true;
        const scoresRecord = rawScores as Record<string, Record<string, Record<string, number>>>;
        const fsmScores = scoresRecord.fsm;
        const testScores = fsmScores?.test;
        const numCorrect = testScores?.numCorrect ?? 0;
        return { testScore: numCorrect };
      };

      await expect(writeTrial(trialData, callback)).resolves.toBeUndefined();

      // Verify that raw score accumulation was called
      expect(accumulationCalled).toBe(true);

      // Verify that the callback was invoked
      expect(callbackCalled).toBe(true);

      // Verify that the fetch call was made and scores were forwarded in the request body
      const eventCalls = fetchMock.mock.calls.filter((call: unknown[]) =>
        (call[0] as string).includes('/runs/run-computed-scores/event'),
      );
      expect(eventCalls).toHaveLength(1);
      const body = JSON.parse(eventCalls[0]![1].body as string);
      expect(body.scores).toBeDefined();
      expect(body.scores).toHaveLength(1);
      expect(body.scores[0]).toMatchObject({
        type: 'computed',
        domain: 'test-domain',
        name: 'testScore',
        value: '1',
      });
    });

    it("calls _accumulateRawScore with 'composite' when trialDataRecord has no subtask field", async () => {
      await initializeFirekitAndStartRun('run-no-subtask');

      const facade = getFirekitCompat();

      const accumulatedSubtasks: string[] = [];
      facade._accumulateRawScore = (subtask: string) => {
        accumulatedSubtasks.push(subtask);
      };

      // SWR-style trial: no subtask field
      const trialData: TrialData = {
        assessmentStage: 'test',
        correct: 1,
        response: 'cat',
        rt: 800,
      };

      await expect(writeTrial(trialData)).resolves.toBeUndefined();

      // Without the ?? 'composite' default, _accumulateRawScore would never be called
      // and testNumAttempted would stay 0, silently skipping all score computation.
      expect(accumulatedSubtasks).toHaveLength(1);
      expect(accumulatedSubtasks[0]).toBe('composite');
    });
  });

  describe('addInteraction', () => {
    const mockContext: CommandContext = {
      baseUrl: 'http://localhost:3000',
      auth: {
        getToken: vi.fn().mockResolvedValue('test-token'),
      },
      participant: {
        participantId: 'participant-123',
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string | Request) => {
          const urlString = typeof url === 'string' ? url : (url as { url?: string }).url || '';
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
        const urlString = typeof url === 'string' ? url : (url as { url?: string }).url || '';
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
        const urlString = typeof url === 'string' ? url : (url as { url?: string }).url || '';
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
        const urlString = typeof url === 'string' ? url : (url as { url?: string }).url || '';
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

  describe('getVariantParamsById', () => {
    beforeEach(() => {
      _resetFirekitCompat();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      _resetFirekitCompat();
    });

    it('throws SDKError when facade is not initialized', async () => {
      await expect(getVariantParamsById('task-123', 'variant-456')).rejects.toThrow(SDKError);
      await expect(getVariantParamsById('task-123', 'variant-456')).rejects.toThrow(
        'appkit.getVariantParamsById requires initialization. Call initFirekitCompat() first.',
      );
    });

    it('retrieves variant params with happy path', async () => {
      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string | Request) => {
        const urlString = typeof url === 'string' ? url : (url as { url?: string }).url || '';

        // Handle variant lookup
        if (urlString.includes('/tasks/task-123/variants/variant-456')) {
          return Promise.resolve({
            status: StatusCodes.OK,
            json: async () => ({
              data: {
                id: 'variant-456',
                taskId: 'task-123',
                parameters: [
                  { name: 'difficulty', value: 'hard' },
                  { name: 'timeLimit', value: 120 },
                ],
              },
            }),
            headers: new Headers([['content-type', 'application/json']]),
          } as Response);
        }

        // Handle startRun
        if (urlString.includes('/runs') && !urlString.includes('/event')) {
          return Promise.resolve({
            status: StatusCodes.CREATED,
            json: async () => ({ data: { id: 'run-123' } }),
            headers: new Headers([['content-type', 'application/json']]),
          } as Response);
        }

        return Promise.reject(new Error(`Unexpected fetch call: ${urlString}`));
      });

      vi.stubGlobal('fetch', fetchMock);
      const mockContext = createMockContext();

      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      const params = await getVariantParamsById('task-123', 'variant-456');

      expect(params).toEqual({
        difficulty: 'hard',
        timeLimit: 120,
      });
    });

    it('returns empty params when variant has no parameters', async () => {
      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string | Request) => {
        const urlString = typeof url === 'string' ? url : (url as { url?: string }).url || '';

        if (urlString.includes('/tasks/task-123/variants/variant-456')) {
          return Promise.resolve({
            status: StatusCodes.OK,
            json: async () => ({
              data: {
                id: 'variant-456',
                taskId: 'task-123',
                parameters: [],
              },
            }),
            headers: new Headers([['content-type', 'application/json']]),
          } as Response);
        }

        if (urlString.includes('/runs') && !urlString.includes('/event')) {
          return Promise.resolve({
            status: StatusCodes.CREATED,
            json: async () => ({ data: { id: 'run-123' } }),
            headers: new Headers([['content-type', 'application/json']]),
          } as Response);
        }

        return Promise.reject(new Error(`Unexpected fetch call: ${urlString}`));
      });

      vi.stubGlobal('fetch', fetchMock);
      const mockContext = createMockContext();

      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      const params = await getVariantParamsById('task-123', 'variant-456');

      expect(params).toEqual({});
    });

    it('propagates SDKError from command on variant not found', async () => {
      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string | Request) => {
        const urlString = typeof url === 'string' ? url : (url as { url?: string }).url || '';

        if (urlString.includes('/tasks/task-123/variants/variant-456')) {
          return Promise.resolve({
            status: StatusCodes.NOT_FOUND,
            json: async () => ({
              error: { message: 'Variant not found' },
            }),
            headers: new Headers([['content-type', 'application/json']]),
          } as Response);
        }

        if (urlString.includes('/runs') && !urlString.includes('/event')) {
          return Promise.resolve({
            status: StatusCodes.CREATED,
            json: async () => ({ data: { id: 'run-123' } }),
            headers: new Headers([['content-type', 'application/json']]),
          } as Response);
        }

        return Promise.reject(new Error(`Unexpected fetch call: ${urlString}`));
      });

      vi.stubGlobal('fetch', fetchMock);
      const mockContext = createMockContext();

      initFirekitCompat(mockContext, {
        variantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      await expect(getVariantParamsById('task-123', 'variant-456')).rejects.toThrow(SDKError);
    });
  });

  describe('FirekitFacade.processUploadQueue', () => {
    /**
     * Creates a mock UploadFileOutput whose upload task captures the state_changed
     * callbacks so tests can trigger success and error paths directly.
     */
    function createMockUploadOutput(filename: string): {
      output: UploadFileOutput;
      mockUploadTask: { on: ReturnType<typeof vi.fn> };
      triggerComplete: () => void;
      triggerError: (error?: { code?: string }) => void;
    } {
      let errorCb: ((error: { code?: string }) => void) | undefined;
      let completeCb: (() => void) | undefined;

      const mockUploadTask = {
        on: vi.fn((_event: string, _next: unknown, error: unknown, complete: unknown) => {
          errorCb = error as typeof errorCb;
          completeCb = complete as typeof completeCb;
          return vi.fn(); // unsubscribe
        }),
      };

      const output: UploadFileOutput = {
        upload: vi.fn().mockReturnValue(mockUploadTask),
        status: UploadStatusEnum.PENDING,
        filename,
        storagePath: `gs://bucket/${filename}`,
      };

      return {
        output,
        mockUploadTask,
        triggerComplete: () => completeCb?.(),
        triggerError: (error?: { code?: string }) => errorCb?.(error ?? { code: 'storage/unknown' }),
      };
    }

    beforeEach(() => {
      vi.clearAllMocks();
      initializeFirekit('run-upload-test');
    });

    afterEach(() => {
      _resetFirekitCompat();
    });

    it('sets status to UPLOADING and calls upload() when a task is added', () => {
      const { output } = createMockUploadOutput('audio.webm');
      const facade = getFirekitCompat();

      facade._addUploadToQueue(output);

      expect(output.upload).toHaveBeenCalledTimes(1);
      expect(output.status).toBe(UploadStatusEnum.UPLOADING);
    });

    it('registers a state_changed listener on the active upload task', () => {
      const { output, mockUploadTask } = createMockUploadOutput('audio.webm');
      const facade = getFirekitCompat();

      facade._addUploadToQueue(output);

      expect(mockUploadTask.on).toHaveBeenCalledWith(
        'state_changed',
        undefined,
        expect.any(Function),
        expect.any(Function),
      );
    });

    it('sets status to COMPLETED and removes task from queue on success', () => {
      const { output, triggerComplete } = createMockUploadOutput('audio.webm');
      const facade = getFirekitCompat();

      facade._addUploadToQueue(output);
      triggerComplete();

      expect(output.status).toBe(UploadStatusEnum.COMPLETED);
    });

    it('starts the next PENDING task after a task completes', () => {
      const first = createMockUploadOutput('first.webm');
      const second = createMockUploadOutput('second.webm');
      const third = createMockUploadOutput('third.webm');
      const fourth = createMockUploadOutput('fourth.webm');
      const facade = getFirekitCompat();

      facade._addUploadToQueue(first.output);
      facade._addUploadToQueue(second.output);
      facade._addUploadToQueue(third.output);
      facade._addUploadToQueue(fourth.output);

      // Concurrency limit reached — fourth is still pending
      expect(fourth.output.upload).not.toHaveBeenCalled();

      first.triggerComplete();

      expect(fourth.output.upload).toHaveBeenCalledTimes(1);
      expect(fourth.output.status).toBe(UploadStatusEnum.UPLOADING);
    });

    it('sets status to FAILED on error', () => {
      const { output, triggerError } = createMockUploadOutput('audio.webm');
      const facade = getFirekitCompat();

      facade._addUploadToQueue(output);
      triggerError({ code: 'storage/unauthorized' });

      expect(output.status).toBe(UploadStatusEnum.FAILED);
    });

    it('removes the failed task from the queue and starts the next PENDING task', () => {
      const first = createMockUploadOutput('first.webm');
      const second = createMockUploadOutput('second.webm');
      const third = createMockUploadOutput('third.webm');
      const fourth = createMockUploadOutput('fourth.webm');
      const facade = getFirekitCompat();

      facade._addUploadToQueue(first.output);
      facade._addUploadToQueue(second.output);
      facade._addUploadToQueue(third.output);
      facade._addUploadToQueue(fourth.output);

      expect(fourth.output.upload).not.toHaveBeenCalled();

      first.triggerError({ code: 'storage/unknown' });

      expect(fourth.output.upload).toHaveBeenCalledTimes(1);
      expect(fourth.output.status).toBe(UploadStatusEnum.UPLOADING);
    });

    it('logs filename to logger.warn on failure', () => {
      const { output, triggerError } = createMockUploadOutput('audio.webm');
      const facade = getFirekitCompat();
      const logger = facade._getLogger();

      facade._addUploadToQueue(output);
      triggerError({ code: 'storage/unauthorized' });

      expect(logger?.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.objectContaining({ code: 'storage/unauthorized' }) }),
        expect.stringContaining('audio.webm'),
      );
    });

    it('handles an error with no code without throwing', () => {
      const { output, triggerError } = createMockUploadOutput('audio.webm');
      const facade = getFirekitCompat();

      facade._addUploadToQueue(output);

      expect(() => triggerError({})).not.toThrow();
      expect(output.status).toBe(UploadStatusEnum.FAILED);
    });

    it('does not start more than 3 concurrent uploads', () => {
      const outputs = Array.from({ length: 5 }, (_, i) =>
        createMockUploadOutput(`file-${i}.webm`),
      );
      const facade = getFirekitCompat();

      outputs.forEach(({ output }) => facade._addUploadToQueue(output));

      const uploadingCount = outputs.filter(({ output }) => output.status === UploadStatusEnum.UPLOADING).length;
      const pendingCount = outputs.filter(({ output }) => output.status === UploadStatusEnum.PENDING).length;

      expect(uploadingCount).toBe(3);
      expect(pendingCount).toBe(2);
    });

    it('does not start a new upload when called while already at the concurrency limit', () => {
      const tasks = Array.from({ length: 3 }, (_, i) =>
        createMockUploadOutput(`file-${i}.webm`),
      );
      const extra = createMockUploadOutput('extra.webm');
      const facade = getFirekitCompat();

      tasks.forEach(({ output }) => facade._addUploadToQueue(output));
      facade._addUploadToQueue(extra.output);

      // Calling processUploadQueue again while 3 are uploading should not start extra
      facade.processUploadQueue();

      expect(extra.output.upload).not.toHaveBeenCalled();
    });

    it('is a no-op when the queue is empty', () => {
      const facade = getFirekitCompat();
      expect(() => facade.processUploadQueue()).not.toThrow();
    });

    it('fully drains the queue as tasks complete in sequence', () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        createMockUploadOutput(`file-${i}.webm`),
      );
      const facade = getFirekitCompat();

      tasks.forEach(({ output }) => facade._addUploadToQueue(output));

      // tasks 0–2 uploading, tasks 3–4 pending
      tasks[0]!.triggerComplete(); // frees a slot → starts task 3
      tasks[1]!.triggerComplete(); // frees a slot → starts task 4
      tasks[2]!.triggerComplete();
      tasks[3]!.triggerComplete();
      tasks[4]!.triggerComplete();

      expect(tasks.every(({ output }) => output.status === UploadStatusEnum.COMPLETED)).toBe(true);
    });

    it('processes pending tasks after a mix of completions and errors', () => {

      const tasks = Array.from({ length: 5 }, (_, i) =>
        createMockUploadOutput(`file-${i}.webm`),
      );
      const facade = getFirekitCompat();

      tasks.forEach(({ output }) => facade._addUploadToQueue(output));

      // tasks 0–2 uploading, tasks 3–4 pending
      tasks[0]!.triggerError({ code: 'storage/unknown' }); // freed slot → starts task 3
      tasks[1]!.triggerComplete();                          // freed slot → starts task 4
      tasks[2]!.triggerComplete();
      tasks[3]!.triggerComplete();
      tasks[4]!.triggerComplete();

      expect(tasks[0]!.output.status).toBe(UploadStatusEnum.FAILED);
      expect(tasks[1]!.output.status).toBe(UploadStatusEnum.COMPLETED);
      expect(tasks[2]!.output.status).toBe(UploadStatusEnum.COMPLETED);
      expect(tasks[3]!.output.status).toBe(UploadStatusEnum.COMPLETED);
      expect(tasks[4]!.output.status).toBe(UploadStatusEnum.COMPLETED);
    });
  });

  describe('uploadFile', () => {
    afterEach(() => {
      _resetFirekitCompat();
    });

    describe('with active anonymous run', () => {
      beforeEach(async () => {
        vi.clearAllMocks();
        await initializeFirekitAndStartRun('run-upload-file-test');
        vi.spyOn(getFirekitCompat(), '_getStorageBucket').mockReturnValue({} as FirebaseStorage);
      });

      it('succeeds when customMetadata is undefined', async () => {
        const storagePath = await uploadFile({
          fileOrBlob: new Blob(['test']),
          filename: 'test.webm',
          taskId: 'task-123',
        });

        expect(storagePath).toBe('gs://mock-bucket/path/to/file.webm');
        expect(uploadBytesResumable).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(Blob),
          undefined,
        );
      });

      it('passes string-valued customMetadata through unchanged', async () => {
        await uploadFile({
          fileOrBlob: new Blob(['test']),
          filename: 'test.webm',
          taskId: 'task-123',
          customMetadata: { key: 'value', label: 'test-label' },
        });

        expect(uploadBytesResumable).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(Blob),
          { customMetadata: { key: 'value', label: 'test-label' } },
        );
      });

      it('stringifies non-string customMetadata values', async () => {
        await uploadFile({
          fileOrBlob: new Blob(['test']),
          filename: 'test.webm',
          taskId: 'task-123',
          // @ts-expect-error testing runtime behavior with non-string values
          customMetadata: { strVal: 'hello', numVal: 42, boolVal: true, objVal: { nested: 'obj' } },
        });

        expect(uploadBytesResumable).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(Blob),
          {
            customMetadata: {
              strVal: 'hello',
              numVal: '42',
              boolVal: 'true',
              objVal: '{"nested":"obj"}',
            },
          },
        );
      });

      it('warns and omits customMetadata when it is not a plain object', async () => {
        const facade = getFirekitCompat();
        const logger = facade._getLogger();

        await uploadFile({
          fileOrBlob: new Blob(['test']),
          filename: 'test.webm',
          taskId: 'task-123',
          // @ts-expect-error testing runtime behavior with non-object value
          customMetadata: 'not-an-object',
        });

        expect(logger?.warn).toHaveBeenCalledWith(
          expect.stringContaining('customMetadata is not an object'),
        );
        expect(uploadBytesResumable).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(Blob),
          undefined,
        );
      });

      it('adds the upload task to the queue', async () => {
        const facade = getFirekitCompat();
        const addToQueueSpy = vi.spyOn(facade, '_addUploadToQueue');

        await uploadFile({
          fileOrBlob: new Blob(['test']),
          filename: 'test.webm',
          taskId: 'task-123',
        });

        expect(addToQueueSpy).toHaveBeenCalledTimes(1);
        expect(addToQueueSpy).toHaveBeenCalledWith(
          expect.objectContaining({ filename: 'test.webm', storagePath: 'gs://mock-bucket/path/to/file.webm' }),
        );
      });
    });

    it('throws SDKError when called without an active run', async () => {
      vi.clearAllMocks();
      initializeFirekit('run-upload-file-test');
      vi.spyOn(getFirekitCompat(), '_getStorageBucket').mockReturnValue({} as FirebaseStorage);

      await expect(
        uploadFile({ fileOrBlob: new Blob(['test']), filename: 'test.webm', taskId: 'task-123' }),
      ).rejects.toThrow('appkit.uploadFile requires an active run');
    });

    it('throws SDKError for non-anonymous run without administrationId', async () => {
      vi.clearAllMocks();
      const { mockContext } = initializeFirekit('run-no-admin', { isAnonymous: false });
      vi.spyOn(getFirekitCompat(), '_getStorageBucket').mockReturnValue({} as FirebaseStorage);

      // Bypass startRun (which would also reject) and set the runId directly
      getFirekitCompat()._setRunId('fake-run-id');
      void mockContext;

      await expect(
        uploadFile({ fileOrBlob: new Blob(['test']), filename: 'test.webm', taskId: 'task-123' }),
      ).rejects.toThrow('appkit.uploadFile requires an administrationId');
    });
  });

  describe('_getStorageBucket / resolveStorageBucket', () => {
    afterEach(() => {
      vi.clearAllMocks();
      vi.unstubAllEnvs();
      _resetFirekitCompat();
    });

    it('memoizes the storage bucket — getStorage is called only once per facade instance', () => {
      initializeFirekit('run-memo-test');
      const facade = getFirekitCompat();

      facade._getStorageBucket();
      facade._getStorageBucket();

      expect(getStorage).toHaveBeenCalledTimes(1);
    });

    it('uses getStorage(getApp()) and connects to the emulator when FIREBASE_AUTH_EMULATOR_HOST is set', () => {
      vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
      initializeFirekit('run-emulator-test');

      getFirekitCompat()._getStorageBucket();

      // No second argument — should use the default app storage, not a named bucket
      expect(getStorage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.anything() }));
      expect(connectStorageEmulator).toHaveBeenCalledWith(expect.anything(), '127.0.0.1', 9199);
    });

    it('does not reconnect the emulator after a facade reset', () => {
      // storageEmulatorConnected is module-level, so it persists across facade resets.
      // The emulator test above already triggered the connection; after reset it should not reconnect.
      vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
      _resetFirekitCompat();
      initializeFirekit('run-emulator-reset-test');

      getFirekitCompat()._getStorageBucket();

      expect(connectStorageEmulator).not.toHaveBeenCalled();
    });

    it('uses the prod recordings bucket when projectId is gse-roar-admin', () => {
      vi.mocked(getApp).mockReturnValue({ options: { projectId: 'gse-roar-admin' } } as ReturnType<typeof getApp>);
      initializeFirekit('run-prod-test');

      getFirekitCompat()._getStorageBucket();

      expect(getStorage).toHaveBeenCalledWith(
        expect.anything(),
        'gs://roar-admin-recordings-prod',
      );
    });

    it('uses the staging recordings bucket when projectId is not gse-roar-admin', () => {
      vi.mocked(getApp).mockReturnValue({ options: { projectId: 'gse-roar-admin-staging' } } as ReturnType<typeof getApp>);
      initializeFirekit('run-staging-test');

      getFirekitCompat()._getStorageBucket();

      expect(getStorage).toHaveBeenCalledWith(
        expect.anything(),
        'gs://roar-admin-recordings-staging',
      );
    });
  });
});
