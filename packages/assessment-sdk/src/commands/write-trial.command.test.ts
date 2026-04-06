import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { WriteTrialCommand } from './write-trial.command';
import { StatusCodes } from 'http-status-codes';
import { createMockRoarApi } from '../test-support';
import type { WriteTrialCommandInput } from '../types/write-trial';
import { RUN_EVENT_TRIAL } from '../types/run-event-status';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums';

/**
 * Test suite for WriteTrialCommand.
 *
 * Tests the command's ability to:
 * - Submit trial data to the backend
 * - Normalize assessment stages and interaction events
 * - Handle optional interactions and payload data
 * - Properly handle success and error responses
 */
describe('WriteTrialCommand', () => {
  let command: WriteTrialCommand;
  let mockApi: ReturnType<typeof createMockRoarApi>;
  let eventMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockRoarApi();
    eventMock = mockApi.client.runs.event as Mock;
    command = new WriteTrialCommand(mockApi);
  });

  it('has correct properties', () => {
    expect(command.name).toBe('WriteTrial');
    expect(command.idempotent).toBe(false);
  });

  it('calls api.client.runs.event with correct parameters and returns empty object on success', async () => {
    const input: WriteTrialCommandInput = {
      runId: 'run-123',
      type: RUN_EVENT_TRIAL,
      trial: {
        assessmentStage: 'test',
        correct: 1,
        response: 'A',
        rt: 1500,
      },
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    const result = await command.execute(input);

    expect(eventMock).toHaveBeenCalledTimes(1);
    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-123' },
      body: {
        type: RUN_EVENT_TRIAL,
        trial: {
          response: 'A',
          rt: 1500,
          assessmentStage: 'test',
          correct: 1,
        },
      },
    });
    expect(result).toEqual({});
  });

  it('normalizes assessment stage from practice_response to practice', async () => {
    const input: WriteTrialCommandInput = {
      runId: 'run-456',
      type: RUN_EVENT_TRIAL,
      trial: {
        assessmentStage: 'practice_response',
        correct: 0,
        response: 'B',
        rt: 2000,
      },
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    const result = await command.execute(input);

    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-456' },
      body: {
        type: RUN_EVENT_TRIAL,
        trial: {
          response: 'B',
          rt: 2000,
          assessmentStage: 'practice',
          correct: 0,
        },
      },
    });
    expect(result).toEqual({});
  });

  it('normalizes assessment stage from test_response to test', async () => {
    const input: WriteTrialCommandInput = {
      runId: 'run-789',
      type: RUN_EVENT_TRIAL,
      trial: {
        assessmentStage: 'test_response',
        correct: 1,
        response: 'C',
        rt: 1200,
      },
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    await command.execute(input);

    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-789' },
      body: {
        type: RUN_EVENT_TRIAL,
        trial: {
          response: 'C',
          rt: 1200,
          assessmentStage: 'test',
          correct: 1,
        },
      },
    });
  });

  it('includes interactions when provided', async () => {
    const input: WriteTrialCommandInput = {
      runId: 'run-with-interactions',
      type: RUN_EVENT_TRIAL,
      trial: {
        assessmentStage: 'test',
        correct: 1,
        response: 'A',
        rt: 1500,
      },
      interactions: [
        { event: 'focus', trial: 1, time: 100 },
        { event: 'blur', trial: 1, time: 200 },
      ],
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    await command.execute(input);

    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-with-interactions' },
      body: {
        type: RUN_EVENT_TRIAL,
        trial: {
          response: 'A',
          rt: 1500,
          assessmentStage: 'test',
          correct: 1,
        },
        interactions: [
          { event: 'focus', timeMs: 100 },
          { event: 'blur', timeMs: 200 },
        ],
      },
    });
  });

  it('normalizes fullscreen interaction events', async () => {
    const input: WriteTrialCommandInput = {
      runId: 'run-fullscreen',
      type: RUN_EVENT_TRIAL,
      trial: {
        assessmentStage: 'test',
        correct: 1,
        response: 'A',
        rt: 1500,
      },
      interactions: [
        { event: 'fullscreenenter', trial: 1, time: 100 },
        { event: 'fullscreenexit', trial: 1, time: 200 },
      ],
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    await command.execute(input);

    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-fullscreen' },
      body: {
        type: RUN_EVENT_TRIAL,
        trial: {
          response: 'A',
          rt: 1500,
          assessmentStage: 'test',
          correct: 1,
        },
        interactions: [
          { event: 'fullscreen_enter', timeMs: 100 },
          { event: 'fullscreen_exit', timeMs: 200 },
        ],
      },
    });
  });

  it('includes optional payload when provided', async () => {
    const payload = { metadata: 'test', customField: 123 };
    const input: WriteTrialCommandInput = {
      runId: 'run-with-payload',
      type: RUN_EVENT_TRIAL,
      trial: {
        assessmentStage: 'practice',
        correct: 1,
        response: 'D',
        rt: 800,
        payload,
      },
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    await command.execute(input);

    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-with-payload' },
      body: {
        type: RUN_EVENT_TRIAL,
        trial: {
          response: 'D',
          rt: 800,
          assessmentStage: 'practice',
          correct: 1,
          payload,
        },
      },
    });
  });

  it('throws SDKError with error message from response body', async () => {
    const input: WriteTrialCommandInput = {
      runId: 'run-123',
      type: RUN_EVENT_TRIAL,
      trial: {
        assessmentStage: 'test',
        correct: 1,
        response: 'A',
        rt: 1500,
      },
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.BAD_REQUEST,
      body: { error: { message: 'Invalid trial data' } },
    });

    const error = await command.execute(input).catch((e) => e);
    expect(error).toBeInstanceOf(SDKError);
    expect((error as SDKError).message).toBe('Invalid trial data');
    expect((error as SDKError).code).toBe(SdkErrorCode.WRITE_TRIAL_FAILED);
  });

  it('throws SDKError with status code message when error details are missing', async () => {
    const input: WriteTrialCommandInput = {
      runId: 'run-123',
      type: RUN_EVENT_TRIAL,
      trial: {
        assessmentStage: 'test',
        correct: 1,
        response: 'A',
        rt: 1500,
      },
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      body: {},
    });

    const error = await command.execute(input).catch((e) => e);
    expect(error).toBeInstanceOf(SDKError);
    expect((error as SDKError).message).toBe('Failed to write trial with status 500');
    expect((error as SDKError).code).toBe(SdkErrorCode.WRITE_TRIAL_FAILED);
  });

  it('throws SDKError with status code message when body is null', async () => {
    const input: WriteTrialCommandInput = {
      runId: 'run-123',
      type: RUN_EVENT_TRIAL,
      trial: {
        assessmentStage: 'test',
        correct: 1,
        response: 'A',
        rt: 1500,
      },
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.NOT_FOUND,
      body: null,
    });

    const error = await command.execute(input).catch((e) => e);
    expect(error).toBeInstanceOf(SDKError);
    expect((error as SDKError).message).toBe('Failed to write trial with status 404');
    expect((error as SDKError).code).toBe(SdkErrorCode.WRITE_TRIAL_FAILED);
  });

  it('propagates errors from api.client.runs.event', async () => {
    const input: WriteTrialCommandInput = {
      runId: 'run-123',
      type: RUN_EVENT_TRIAL,
      trial: {
        assessmentStage: 'test',
        correct: 1,
        response: 'A',
        rt: 1500,
      },
    };

    eventMock.mockRejectedValue(new Error('Network error'));

    await expect(command.execute(input)).rejects.toThrow('Network error');
  });
});
