import { describe, it, expect, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { AbortRunCommand } from './abort-run.command';
import { StatusCodes } from 'http-status-codes';
import { createMockRoarApi } from '../test-support';
import type { AbortRunInput } from '../types/abort-run';

describe('AbortRunCommand', () => {
  let command: AbortRunCommand;
  let mockApi: ReturnType<typeof createMockRoarApi>;
  let eventMock: Mock;

  beforeEach(() => {
    mockApi = createMockRoarApi();
    eventMock = mockApi.client.runs.event as Mock;
    command = new AbortRunCommand(mockApi);
  });

  it('has correct properties', () => {
    expect(command.name).toBe('AbortRun');
    expect(command.idempotent).toBe(true);
  });

  it('calls api.client.runs.event with correct parameters and returns empty object on success', async () => {
    const input: AbortRunInput = {
      runId: 'run-123',
      type: 'abort',
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    const result = await command.execute(input);

    expect(eventMock).toHaveBeenCalledTimes(1);
    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-123' },
      body: { type: 'abort' },
    });
    expect(result).toEqual({});
  });

  it('throws SDKError with error message from response body', async () => {
    const input: AbortRunInput = {
      runId: 'run-123',
      type: 'abort',
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.BAD_REQUEST,
      body: { error: { message: 'Run not found' } },
    });

    await expect(command.execute(input)).rejects.toThrow('Run not found');
  });

  it('throws SDKError with status code message when error details are missing', async () => {
    const input: AbortRunInput = {
      runId: 'run-123',
      type: 'abort',
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      body: {},
    });

    await expect(command.execute(input)).rejects.toThrow('Failed to abort run with status 500');
  });

  it('propagates errors from api.client.runs.event', async () => {
    const input: AbortRunInput = {
      runId: 'run-123',
      type: 'abort',
    };

    eventMock.mockRejectedValue(new Error('Network error'));

    await expect(command.execute(input)).rejects.toThrow('Network error');
  });
});
