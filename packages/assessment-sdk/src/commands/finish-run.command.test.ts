import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { FinishRunCommand } from './finish-run.command';
import { StatusCodes } from 'http-status-codes';
import { createMockRoarApi } from '../test-support';
import type { FinishRunInput } from '../types/finish-run';
import { RUN_EVENT_COMPLETE } from '../types/finish-run';

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

  it('calls api.client.runs.event with correct parameters and returns empty object on success', async () => {
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
    expect(result).toEqual({});
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
    expect(result).toEqual({});
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

    await expect(command.execute(input)).rejects.toThrow('Run not found');
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
