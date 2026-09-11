import { describe, it, expect, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { GetTaskVariantCommand } from './get-variant-id.command';
import { createMockRoarApi } from '../test-support';
import type { GetTaskVariantInput, GetTaskVariantOutput } from './get-variant-id.command';

describe('GetTaskVariantCommand', () => {
  let command: GetTaskVariantCommand;
  let mockApi: ReturnType<typeof createMockRoarApi>;
  let getTaskVariant: Mock;

  beforeEach(() => {
    mockApi = createMockRoarApi();
    getTaskVariant = mockApi.client.tasks.getTaskVariant as Mock;
    command = new GetTaskVariantCommand(mockApi);
  });

  it('has correct properties', () => {
    expect(command.name).toBe('GetTaskVariant');
    expect(command.idempotent).toBe(true);
  });

  it('calls client.tasks.getTaskVariant and returns variant data', async () => {
    const input: GetTaskVariantInput = {
      taskId: 'task-456',
      variantId: 'variant-123',
    };

    const expected: GetTaskVariantOutput = {
      variantId: 'variant-123',
      taskId: 'task-456',
      variantParams: {
        difficulty: 'hard',
        timeLimit: 120,
        shuffleItems: true,
      },
    };

    getTaskVariant.mockResolvedValue({
      status: StatusCodes.OK,
      body: {
        data: {
          id: 'variant-123',
          taskId: 'task-456',
          parameters: [
            { name: 'difficulty', value: 'hard' },
            { name: 'timeLimit', value: 120 },
            { name: 'shuffleItems', value: true },
          ],
        },
      },
    });

    const result = await command.execute(input);

    expect(getTaskVariant).toHaveBeenCalledTimes(1);
    expect(getTaskVariant).toHaveBeenCalledWith({
      params: { taskId: 'task-456', variantId: 'variant-123' },
    });
    expect(result).toEqual(expected);
  });

  it('returns variant data with empty params', async () => {
    const input: GetTaskVariantInput = {
      taskId: 'task-999',
      variantId: 'variant-789',
    };

    const expected: GetTaskVariantOutput = {
      variantId: 'variant-789',
      taskId: 'task-999',
      variantParams: {},
    };

    getTaskVariant.mockResolvedValue({
      status: StatusCodes.OK,
      body: { data: { id: 'variant-789', taskId: 'task-999', parameters: [] } },
    });

    const result = await command.execute(input);

    expect(getTaskVariant).toHaveBeenCalledWith({
      params: { taskId: 'task-999', variantId: 'variant-789' },
    });
    expect(result).toEqual(expected);
    expect(result.variantParams).toEqual({});
  });

  it('returns variant data with complex params', async () => {
    const input: GetTaskVariantInput = {
      taskId: 'task-complex',
      variantId: 'variant-complex',
    };

    const complexParams = {
      difficulty: 'medium',
      timeLimit: 180,
      config: {
        mode: 'adaptive',
        startingLevel: 1,
        enableAudio: false,
        maxAttempts: null,
      },
      stimuli: ['word1', 'word2', 'word3'],
    };

    const expected: GetTaskVariantOutput = {
      variantId: 'variant-complex',
      taskId: 'task-complex',
      variantParams: complexParams,
    };

    getTaskVariant.mockResolvedValue({
      status: StatusCodes.OK,
      body: {
        data: {
          id: 'variant-complex',
          taskId: 'task-complex',
          parameters: [
            { name: 'difficulty', value: 'medium' },
            { name: 'timeLimit', value: 180 },
            { name: 'config', value: complexParams.config },
            { name: 'stimuli', value: complexParams.stimuli },
          ],
        },
      },
    });

    const result = await command.execute(input);

    expect(result).toEqual(expected);
    expect(result.variantParams).toEqual(complexParams);
  });

  it('propagates errors from client.tasks.getTaskVariant', async () => {
    const input: GetTaskVariantInput = {
      taskId: 'task-456',
      variantId: 'variant-123',
    };

    getTaskVariant.mockResolvedValue({
      status: StatusCodes.NOT_FOUND,
      body: { error: { message: 'Variant not found' } },
    });

    await expect(command.execute(input)).rejects.toThrow('Variant not found');
  });

  it('propagates network errors', async () => {
    const input: GetTaskVariantInput = {
      taskId: 'task-456',
      variantId: 'variant-123',
    };

    getTaskVariant.mockRejectedValue(new Error('Network request failed'));

    await expect(command.execute(input)).rejects.toThrow('Network request failed');
  });

  it('throws SDKError on 500 response', async () => {
    const input: GetTaskVariantInput = {
      taskId: 'task-456',
      variantId: 'variant-123',
    };

    getTaskVariant.mockResolvedValue({
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      body: { error: { message: 'Internal server error' } },
    });

    await expect(command.execute(input)).rejects.toThrow('Internal server error');
  });
});
