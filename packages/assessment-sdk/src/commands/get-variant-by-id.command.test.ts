import { describe, it, expect, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { GetVariantByIdCommand } from './get-variant-by-id.command';
import { createMockRoarApi } from '../test-support';
import type { GetVariantByIdInput, GetVariantByIdOutput } from './get-variant-by-id.command';

describe('GetVariantByIdCommand', () => {
  let command: GetVariantByIdCommand;
  let mockApi: ReturnType<typeof createMockRoarApi>;
  let getByIdWithTaskDetails: Mock;

  beforeEach(() => {
    mockApi = createMockRoarApi();
    getByIdWithTaskDetails = mockApi.client.taskVariants.getByIdWithTaskDetails as Mock;
    command = new GetVariantByIdCommand(mockApi);
  });

  it('has correct properties', () => {
    expect(command.name).toBe('GetVariantById');
    expect(command.idempotent).toBe(true);
  });

  it('calls client.taskVariants.getByIdWithTaskDetails with the variant ID', async () => {
    const input: GetVariantByIdInput = { variantId: 'variant-123' };

    getByIdWithTaskDetails.mockResolvedValue({
      status: StatusCodes.OK,
      body: {
        data: {
          id: 'variant-123',
          taskId: 'task-456',
          parameters: [{ name: 'difficulty', value: 'hard' }],
        },
      },
    });

    await command.execute(input);

    expect(getByIdWithTaskDetails).toHaveBeenCalledTimes(1);
    expect(getByIdWithTaskDetails).toHaveBeenCalledWith({ params: { variantId: 'variant-123' } });
  });

  it('maps { name, value } parameter tuples to a flat Record', async () => {
    const input: GetVariantByIdInput = { variantId: 'variant-abc' };

    const expected: GetVariantByIdOutput = {
      variantId: 'variant-abc',
      taskId: 'task-xyz',
      variantParams: {
        difficulty: 'medium',
        timeLimit: 120,
        shuffleItems: true,
      },
    };

    getByIdWithTaskDetails.mockResolvedValue({
      status: StatusCodes.OK,
      body: {
        data: {
          id: 'variant-abc',
          taskId: 'task-xyz',
          parameters: [
            { name: 'difficulty', value: 'medium' },
            { name: 'timeLimit', value: 120 },
            { name: 'shuffleItems', value: true },
          ],
        },
      },
    });

    const result = await command.execute(input);

    expect(result).toEqual(expected);
  });

  it('returns an empty variantParams object when parameters is empty', async () => {
    const input: GetVariantByIdInput = { variantId: 'variant-empty' };

    getByIdWithTaskDetails.mockResolvedValue({
      status: StatusCodes.OK,
      body: {
        data: { id: 'variant-empty', taskId: 'task-empty', parameters: [] },
      },
    });

    const result = await command.execute(input);

    expect(result.variantParams).toEqual({});
  });

  it('preserves complex parameter values (objects, arrays, null)', async () => {
    const input: GetVariantByIdInput = { variantId: 'variant-complex' };

    const complexConfig = { mode: 'adaptive', startingLevel: 1, enableAudio: false };
    const stimuli = ['word1', 'word2'];

    getByIdWithTaskDetails.mockResolvedValue({
      status: StatusCodes.OK,
      body: {
        data: {
          id: 'variant-complex',
          taskId: 'task-complex',
          parameters: [
            { name: 'config', value: complexConfig },
            { name: 'stimuli', value: stimuli },
            { name: 'maxAttempts', value: null },
          ],
        },
      },
    });

    const result = await command.execute(input);

    expect(result.variantParams).toEqual({
      config: complexConfig,
      stimuli,
      maxAttempts: null,
    });
  });

  it('throws SDKError with the server error message on non-200 response', async () => {
    const input: GetVariantByIdInput = { variantId: 'variant-missing' };

    getByIdWithTaskDetails.mockResolvedValue({
      status: StatusCodes.NOT_FOUND,
      body: { error: { message: 'Variant not found' } },
    });

    await expect(command.execute(input)).rejects.toThrow('Variant not found');
  });

  it('falls back to a generic message when the error body has no message', async () => {
    const input: GetVariantByIdInput = { variantId: 'variant-bad' };

    getByIdWithTaskDetails.mockResolvedValue({
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      body: { error: {} },
    });

    await expect(command.execute(input)).rejects.toThrow(
      `Failed to get variant with status ${StatusCodes.INTERNAL_SERVER_ERROR}`,
    );
  });

  it('propagates network errors without wrapping', async () => {
    const input: GetVariantByIdInput = { variantId: 'variant-net' };

    getByIdWithTaskDetails.mockRejectedValue(new Error('Network request failed'));

    await expect(command.execute(input)).rejects.toThrow('Network request failed');
  });
});
