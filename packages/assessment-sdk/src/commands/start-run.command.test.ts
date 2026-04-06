import { describe, it, expect, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { StartRunCommand } from './start-run.command';
import { StatusCodes } from 'http-status-codes';
import { createMockRoarApi } from '../test-support';
import type { StartRunInput, StartRunOutput } from '../types/start-run';
import type { CommandContext } from '../command/command';

describe('StartRunCommand', () => {
  let command: StartRunCommand;
  let mockApi: ReturnType<typeof createMockRoarApi>;
  let createRun: Mock;
  let mockContext: CommandContext;

  beforeEach(() => {
    mockApi = createMockRoarApi();
    createRun = mockApi.client.runs.create as Mock;
    mockContext = {
      baseUrl: 'https://api.example.com',
      auth: {
        getToken: async () => 'test-token',
      },
      participant: {
        participantId: 'participant-123',
      },
    };
    command = new StartRunCommand(mockApi, mockContext);
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

  it('throws error when participantId is missing', async () => {
    const contextWithoutParticipant: CommandContext = {
      baseUrl: 'https://api.example.com',
      auth: {
        getToken: async () => 'test-token',
      },
      participant: {
        participantId: '',
      },
    };
    const cmdWithoutParticipant = new StartRunCommand(mockApi, contextWithoutParticipant);

    const input: StartRunInput = {
      variantId: 'variant-123',
      taskVersion: '1.0.0',
      isAnonymous: true,
    };

    await expect(cmdWithoutParticipant.execute(input)).rejects.toThrow('participantId is required to start a run');
  });

  it('throws error when participant context is missing', async () => {
    const contextWithoutParticipant: CommandContext = {
      baseUrl: 'https://api.example.com',
      auth: {
        getToken: async () => 'test-token',
      },
      participant: {
        // @ts-expect-error - Testing missing participantId scenario
        participantId: undefined,
      },
    };
    const cmdWithoutParticipant = new StartRunCommand(mockApi, contextWithoutParticipant);

    const input: StartRunInput = {
      variantId: 'variant-123',
      taskVersion: '1.0.0',
      isAnonymous: true,
    };

    await expect(cmdWithoutParticipant.execute(input)).rejects.toThrow('participantId is required to start a run');
  });
});
