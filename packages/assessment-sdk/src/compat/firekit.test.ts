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
  _resetFirekitCompat,
  getFirekitCompat,
} from './firekit';
import { SDKError } from '../errors/sdk-error';
import type { AddInteractionInput, UpdateUserInput, TrialData, RawScores, ComputedScores } from '../types';
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
            json: async () => ({ data: { id: 'run-finish-test' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
        // Return 200 for finishRun (POST /runs/:runId/event)
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
      await expect(finishRun()).resolves.toBeUndefined();

      // Verify fetch was called with the finish event endpoint
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/runs/run-finish-test/event'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('complete'),
        }),
      );
    });

    it('includes metadata when provided', async () => {
      const mockContext: CommandContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
      };

      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/runs') && !url.includes('/event')) {
          return Promise.resolve({
            status: 201,
            json: async () => ({ data: { id: 'run-finish-metadata' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
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
      };

      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/runs') && !url.includes('/event')) {
          return Promise.resolve({
            status: 201,
            json: async () => ({ data: { id: 'run-engagement-test' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
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
    });

    it('sends engagement flags with markAsReliable when provided', async () => {
      const mockContext: CommandContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
      };

      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/runs') && !url.includes('/event')) {
          return Promise.resolve({
            status: 201,
            json: async () => ({ data: { id: 'run-reliable-test' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
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
            json: async () => ({ data: { id: 'run-trial-test' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
        // Return 200 for writeTrial (POST /runs/:runId/event)
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
      const mockContext: CommandContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/runs') && !url.includes('/event')) {
            return Promise.resolve({
              status: 201,
              json: async () => ({ data: { id: 'run-trial-callback' } }),
              headers: new Headers([['content-type', 'application/json']]),
            });
          }
          if (url.includes('/event')) {
            return Promise.resolve({
              status: 200,
              json: async () => ({ data: { status: 'ok' } }),
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

      await startRun();

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
      const mockContext: CommandContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
      };

      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/runs') && !url.includes('/event')) {
          return Promise.resolve({
            status: 201,
            json: async () => ({ data: { id: 'run-bool-true' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
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
      const mockContext: CommandContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
      };

      const fetchMock = vi.fn();
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/runs') && !url.includes('/event')) {
          return Promise.resolve({
            status: 201,
            json: async () => ({ data: { id: 'run-bool-false' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
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

    it('flushes buffered interactions with trial data', async () => {
      const mockContext: CommandContext = {
        baseUrl: 'http://localhost:3000',
        auth: {
          getToken: vi.fn().mockResolvedValue('test-token'),
        },
      };

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/runs') && !url.includes('/event')) {
          return Promise.resolve({
            status: 201,
            json: async () => ({ data: { id: 'run-with-interactions' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
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

      // Buffer interactions
      addInteraction({ event: 'focus', time: 100 });
      addInteraction({ event: 'blur', time: 200 });

      const trialData: TrialData = {
        assessmentStage: 'test',
        correct: 1,
        response: 'A',
        rt: 500,
      };

      await expect(writeTrial(trialData)).resolves.toBeUndefined();

      // Verify interactions were sent in the request body
      const eventCall = fetchMock.mock.calls.find((call) => call[0].includes('/event'));
      expect(eventCall).toBeDefined();
      const body = JSON.parse(eventCall![1].body as string);
      expect(body.interactions).toHaveLength(2);
      expect(body.interactions[0].event).toBe('focus');
      expect(body.interactions[1].event).toBe('blur');
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
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/runs') && !url.includes('/event')) {
            return Promise.resolve({
              status: 201,
              json: async () => ({ data: { id: 'run-interaction-test' } }),
              headers: new Headers([['content-type', 'application/json']]),
            });
          }
          if (url.includes('/event')) {
            return Promise.resolve({
              status: 200,
              json: async () => ({ data: { status: 'ok' } }),
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
      await startRun();
      addInteraction({ event: 'focus', time: 100 });
      addInteraction({ event: 'blur', time: 200 });
      addInteraction({ event: 'fullscreenenter', time: 300 });
      addInteraction({ event: 'fullscreenexit', time: 400 });

      // Verify all 4 interactions are in the buffer
      const facade = getFirekitCompat();
      const buffer = facade._getInteractionBuffer();
      expect(buffer).toHaveLength(4);
      expect(buffer[0]!.event).toBe('focus');
      expect(buffer[1]!.event).toBe('blur');
      expect(buffer[2]!.event).toBe('fullscreenenter');
      expect(buffer[3]!.event).toBe('fullscreenexit');
    });

    it('clears buffer after writeTrial', async () => {
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/runs') && !url.includes('/event')) {
          return Promise.resolve({
            status: 201,
            json: async () => ({ data: { id: 'run-buffer-clear' } }),
            headers: new Headers([['content-type', 'application/json']]),
          });
        }
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

    it('matches Firekit signature', () => {
      expect(typeof addInteraction).toBe('function');

      expectTypeOf(addInteraction).toEqualTypeOf<(interaction: AddInteractionInput) => void>();
    });
  });
});
