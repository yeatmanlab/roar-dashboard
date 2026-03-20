import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { FinishRunCommand } from './finish-run.command';
import { StatusCodes } from 'http-status-codes';
import { createMockRoarApi } from '../test-support';
import type { FinishRunInput } from '../types/finish-run';
import { RUN_EVENT_COMPLETE } from '../types/run-event-status';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums';

describe('FinishRunCommand', () => {
  let command: FinishRunCommand;
  let mockApi: ReturnType<typeof createMockRoarApi>;
  let eventMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockRoarApi();
    eventMock = mockApi.client.runs.event as Mock;
    command = new FinishRunCommand(mockApi);
  });

  it('has correct properties', () => {
    expect(command.name).toBe('FinishRun');
    expect(command.idempotent).toBe(false);
  });

  it('calls api.client.runs.event with correct parameters and returns status on success', async () => {
    const input: FinishRunInput = {
      runId: 'run-123',
      type: RUN_EVENT_COMPLETE,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    const result = await command.execute(input);

    expect(eventMock).toHaveBeenCalledTimes(1);
    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-123' },
      body: { type: RUN_EVENT_COMPLETE },
    });
    expect(result).toEqual({ status: 'ok' });
  });

  it('calls api.client.runs.event with metadata when provided', async () => {
    const metadata = { reason: 'user_quit', timestamp: 1234567890 };
    const input: FinishRunInput = {
      runId: 'run-456',
      type: RUN_EVENT_COMPLETE,
      metadata,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    const result = await command.execute(input);

    expect(eventMock).toHaveBeenCalledTimes(1);
    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-456' },
      body: { type: RUN_EVENT_COMPLETE, metadata },
    });
    expect(result).toEqual({ status: 'ok' });
  });

  it('treats 409 Conflict as success (run already finished)', async () => {
    const input: FinishRunInput = {
      runId: 'run-789',
      type: RUN_EVENT_COMPLETE,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.CONFLICT,
      body: { error: { message: 'Run already in terminal state' } },
    });

    const result = await command.execute(input);

    expect(eventMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'ok' });
  });

  it('throws SDKError with error message from response body', async () => {
    const input: FinishRunInput = {
      runId: 'run-123',
      type: RUN_EVENT_COMPLETE,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.BAD_REQUEST,
      body: { error: { message: 'Run not found' } },
    });

    await expect(command.execute(input)).rejects.toThrow(SDKError);
    try {
      await command.execute(input);
    } catch (err) {
      expect(err).toBeInstanceOf(SDKError);
      expect((err as SDKError).message).toBe('Run not found');
      expect((err as SDKError).code).toBe(SdkErrorCode.FINISH_RUN_FAILED);
    }
  });

  it('throws SDKError with status code message when error details are missing', async () => {
    const input: FinishRunInput = {
      runId: 'run-123',
      type: RUN_EVENT_COMPLETE,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      body: {},
    });

    await expect(command.execute(input)).rejects.toThrow('Failed to finish run with status 500');
  });

  it('throws SDKError with status code message when body is null', async () => {
    const input: FinishRunInput = {
      runId: 'run-123',
      type: RUN_EVENT_COMPLETE,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.NOT_FOUND,
      body: null,
    });

    await expect(command.execute(input)).rejects.toThrow('Failed to finish run with status 404');
  });

  it('propagates errors from api.client.runs.event', async () => {
    const input: FinishRunInput = {
      runId: 'run-123',
      type: RUN_EVENT_COMPLETE,
    };

    eventMock.mockRejectedValue(new Error('Network error'));

    await expect(command.execute(input)).rejects.toThrow('Network error');
  });
});
