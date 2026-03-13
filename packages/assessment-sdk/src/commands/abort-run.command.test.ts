import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AbortRunCommand } from './abort-run.command';
import type { RoarApi } from '../receiver/roar-api';
import type { AbortRunInput } from '../types/abort-run';

describe('AbortRunCommand', () => {
  let command: AbortRunCommand;
  let mockApi: RoarApi;
  let postRunEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postRunEvent = vi.fn();
    mockApi = { postRunEvent } as unknown as RoarApi;
    command = new AbortRunCommand(mockApi);
  });

  it('has correct properties', () => {
    expect(command.name).toBe('AbortRun');
    expect(command.idempotent).toBe(true);
  });

  it('calls api.postRunEvent with event type from input', async () => {
    const input: AbortRunInput = {
      runId: 'run-123',
      type: 'abort',
    };

    postRunEvent.mockResolvedValue(undefined);

    await command.execute(input);

    expect(postRunEvent).toHaveBeenCalledTimes(1);
    expect(postRunEvent).toHaveBeenCalledWith('run-123', { type: input.type });
  });

  it('propagates errors from api.postRunEvent', async () => {
    const input: AbortRunInput = {
      runId: 'run-123',
      type: 'abort',
    };

    postRunEvent.mockRejectedValue(new Error('API request failed'));

    await expect(command.execute(input)).rejects.toThrow('API request failed');
  });
});
