import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StartRunCommand } from './start-run.command';
import { StatusCodes } from 'http-status-codes';
import type { RoarApi } from '../receiver/roar-api';
import type { StartRunInput, StartRunOutput } from '../types/start-run';

describe('StartRunCommand', () => {
  let command: StartRunCommand;
  let mockApi: RoarApi;
  let createRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createRun = vi.fn();
    mockApi = {
      client: {
        runs: {
          create: createRun,
        },
      },
    } as unknown as RoarApi;
    command = new StartRunCommand(mockApi);
  });

  it('has correct properties', () => {
    expect(command.name).toBe('StartRun');
    expect(command.idempotent).toBe(false);
  });

  it('calls api.createRun and returns result (anonymous)', async () => {
    const input: StartRunInput = {
      variantId: 'variant-123',
      taskVersion: '1.0.0',
      isAnonymous: true,
    };

    const expected: StartRunOutput = { runId: 'run-456' };
    createRun.mockResolvedValue({
      status: StatusCodes.CREATED,
      body: { data: { id: 'run-456' } },
    });

    const result = await command.execute(input);

    expect(createRun).toHaveBeenCalledTimes(1);
    expect(createRun).toHaveBeenCalledWith({
      body: {
        taskVariantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: true,
      },
    });
    expect(result).toEqual(expected);
  });

  it('calls api.createRun and returns result (non-anonymous)', async () => {
    const input: StartRunInput = {
      variantId: 'variant-123',
      taskVersion: '1.0.0',
      isAnonymous: false,
      administrationId: 'admin-456',
    };

    const expected: StartRunOutput = { runId: 'run-999' };
    createRun.mockResolvedValue({
      status: StatusCodes.CREATED,
      body: { data: { id: 'run-999' } },
    });

    const result = await command.execute(input);

    expect(createRun).toHaveBeenCalledTimes(1);
    expect(createRun).toHaveBeenCalledWith({
      body: {
        taskVariantId: 'variant-123',
        taskVersion: '1.0.0',
        isAnonymous: false,
        administrationId: 'admin-456',
      },
    });
    expect(result).toEqual(expected);
  });

  it('propagates errors from api.createRun', async () => {
    const input: StartRunInput = {
      variantId: 'variant-123',
      taskVersion: '1.0.0',
      isAnonymous: true,
    };

    createRun.mockRejectedValue(new Error('API request failed'));

    await expect(command.execute(input)).rejects.toThrow('API request failed');
  });

  it('extracts error message from result body', async () => {
    const input: StartRunInput = {
      variantId: 'variant-123',
      taskVersion: '1.0.0',
      isAnonymous: true,
    };

    createRun.mockResolvedValue({
      status: StatusCodes.BAD_REQUEST,
      body: { error: { message: 'Invalid variant ID provided' } },
    });

    await expect(command.execute(input)).rejects.toThrow('Invalid variant ID provided');
  });

  it('falls back to status code message when error details are missing', async () => {
    const input: StartRunInput = {
      variantId: 'variant-123',
      taskVersion: '1.0.0',
      isAnonymous: true,
    };

    createRun.mockResolvedValue({
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      body: { someField: 'value' },
    });

    await expect(command.execute(input)).rejects.toThrow('Failed to start run with status 500');
  });

  it('falls back to status code message when body is null', async () => {
    const input: StartRunInput = {
      variantId: 'variant-123',
      taskVersion: '1.0.0',
      isAnonymous: true,
    };

    createRun.mockResolvedValue({
      status: StatusCodes.NOT_FOUND,
      body: null,
    });

    await expect(command.execute(input)).rejects.toThrow('Failed to start run with status 404');
  });
});
