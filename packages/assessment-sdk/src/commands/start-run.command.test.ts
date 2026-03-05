import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StartRunCommand } from './start-run.command';
import type { RoarApi } from '../receiver/roar-api';
import type { StartRunInput, StartRunOutput } from '../types/start-run';

describe('StartRunCommand', () => {
  let command: StartRunCommand;
  let mockApi: RoarApi;
  let createRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createRun = vi.fn();
    mockApi = { createRun } as unknown as RoarApi;
    command = new StartRunCommand(mockApi);
  });

  it('has correct properties', () => {
    expect(command.name).toBe('StartRun');
    expect(command.idempotent).toBe(false);
  });

  it('calls api.createRun and returns result (anonymous)', async () => {
    const input: StartRunInput = {
      type: 'start',
      variantId: 'variant-123',
      taskVersion: '1.0.0',
      isAnonymous: true,
    };

    const expected: StartRunOutput = { runId: 'run-456' };
    createRun.mockResolvedValue(expected);

    const result = await command.execute(input);

    expect(createRun).toHaveBeenCalledTimes(1);
    expect(createRun).toHaveBeenCalledWith(input);
    expect(result).toEqual(expected);
  });

  it('calls api.createRun and returns result (non-anonymous)', async () => {
    const input: StartRunInput = {
      type: 'start',
      variantId: 'variant-123',
      taskVersion: '1.0.0',
      isAnonymous: false,
      administrationId: 'admin-456',
    };

    const expected: StartRunOutput = { runId: 'run-999' };
    createRun.mockResolvedValue(expected);

    const result = await command.execute(input);

    expect(createRun).toHaveBeenCalledTimes(1);
    expect(createRun).toHaveBeenCalledWith(input);
    expect(result).toEqual(expected);
  });

  it('propagates errors from api.createRun', async () => {
    const input: StartRunInput = {
      type: 'start',
      variantId: 'variant-123',
      taskVersion: '1.0.0',
      isAnonymous: true,
    };

    createRun.mockRejectedValue(new Error('API request failed'));

    await expect(command.execute(input)).rejects.toThrow('API request failed');
  });
});
