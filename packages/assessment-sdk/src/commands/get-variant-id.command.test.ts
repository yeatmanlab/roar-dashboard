import { describe, it, expect, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { GetVariantIDCommand } from './get-variant-id.command';
import { createMockRoarApi } from '../test-support';
import type { GetVariantIDInput, GetVariantIDOutput } from './get-variant-id.command';

describe('GetVariantIDCommand', () => {
  let command: GetVariantIDCommand;
  let mockApi: ReturnType<typeof createMockRoarApi>;
  let getVariantById: Mock;

  beforeEach(() => {
    mockApi = createMockRoarApi();
    getVariantById = mockApi.getVariantById as Mock;
    command = new GetVariantIDCommand(mockApi);
  });

  it('has correct properties', () => {
    expect(command.name).toBe('GetVariantID');
    expect(command.idempotent).toBe(true);
  });

  it('calls api.getVariantById and returns variant data', async () => {
    const input: GetVariantIDInput = {
      task_id: 'task-456',
      variant_id: 'variant-123',
    };

    const expected: GetVariantIDOutput = {
      variant_id: 'variant-123',
      task_id: 'task-456',
      task_version: '1.0.0',
      variant_params: {
        timeLimit: 120,
        random: true,
      },
    };

    getVariantById.mockResolvedValue(expected);

    const result = await command.execute(input);

    expect(getVariantById).toHaveBeenCalledTimes(1);
    expect(getVariantById).toHaveBeenCalledWith('task-456', 'variant-123');
    expect(result).toEqual(expected);
  });

  it('returns variant data with empty params', async () => {
    const input: GetVariantIDInput = {
      task_id: 'task-999',
      variant_id: 'variant-789',
    };

    const expected: GetVariantIDOutput = {
      variant_id: 'variant-789',
      task_id: 'task-999',
      task_version: '2.0.0',
      variant_params: {},
    };

    getVariantById.mockResolvedValue(expected);

    const result = await command.execute(input);

    expect(getVariantById).toHaveBeenCalledWith('task-999', 'variant-789');
    expect(result).toEqual(expected);
    expect(result.variant_params).toEqual({});
  });

  it('returns variant data with complex params', async () => {
    const input: GetVariantIDInput = {
      task_id: 'task-complex',
      variant_id: 'variant-complex',
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

    const expected: GetVariantIDOutput = {
      variant_id: 'variant-complex',
      task_id: 'task-complex',
      task_version: '1.5.0',
      variant_params: complexParams,
    };

    getVariantById.mockResolvedValue(expected);

    const result = await command.execute(input);

    expect(result).toEqual(expected);
    expect(result.variant_params).toEqual(complexParams);
  });

  it('propagates errors from api.getVariantById', async () => {
    const input: GetVariantIDInput = {
      task_id: 'task-456',
      variant_id: 'variant-123',
    };

    getVariantById.mockRejectedValue(new Error('Variant not found'));

    await expect(command.execute(input)).rejects.toThrow('Variant not found');
  });

  it('propagates network errors', async () => {
    const input: GetVariantIDInput = {
      task_id: 'task-456',
      variant_id: 'variant-123',
    };

    const networkError = new Error('Network request failed');
    getVariantById.mockRejectedValue(networkError);

    await expect(command.execute(input)).rejects.toThrow('Network request failed');
  });
});
