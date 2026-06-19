import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { bootstrapAnonymousSession } from './bootstrap';
import { createApiClient } from './receiver/roar-api';
import { SDKError } from './errors/sdk-error';
import { SdkErrorCode } from './enums/sdk-error-code.enum';
import type { BootstrapContext } from './bootstrap';

vi.mock('./receiver/roar-api', () => ({
  createApiClient: vi.fn(),
}));

const ctx: BootstrapContext = {
  baseUrl: 'https://api.example.com',
  auth: { getToken: async () => 'anon-token' },
};

const PARTICIPANT_ID = '11111111-1111-1111-1111-111111111111';
const VARIANT_ID = '22222222-2222-2222-2222-222222222222';
const TASK_ID = 'task-abc';

describe('bootstrapAnonymousSession', () => {
  let createAnonymous: Mock;
  let listTaskVariants: Mock;

  beforeEach(() => {
    createAnonymous = vi.fn();
    listTaskVariants = vi.fn();
    (createApiClient as Mock).mockReturnValue({
      users: { createAnonymous },
      tasks: { listTaskVariants },
    });

    createAnonymous.mockResolvedValue({
      status: StatusCodes.OK,
      body: { data: { id: PARTICIPANT_ID } },
    });
  });

  it('provisions the anonymous user and returns the participantId', async () => {
    const result = await bootstrapAnonymousSession(ctx);

    expect(createApiClient).toHaveBeenCalledWith(ctx);
    expect(createAnonymous).toHaveBeenCalledTimes(1);
    expect(listTaskVariants).not.toHaveBeenCalled();
    expect(result).toEqual({ participantId: PARTICIPANT_ID });
  });

  it('returns the provided variantId without a lookup', async () => {
    const result = await bootstrapAnonymousSession(ctx, { variantId: VARIANT_ID, taskId: TASK_ID });

    expect(listTaskVariants).not.toHaveBeenCalled();
    expect(result).toEqual({ participantId: PARTICIPANT_ID, variantId: VARIANT_ID });
  });

  it('returns the provided variantId without a taskId', async () => {
    const result = await bootstrapAnonymousSession(ctx, { variantId: VARIANT_ID });

    expect(listTaskVariants).not.toHaveBeenCalled();
    expect(result).toEqual({ participantId: PARTICIPANT_ID, variantId: VARIANT_ID });
  });

  it('resolves the first published variant for a taskId', async () => {
    listTaskVariants.mockResolvedValue({
      status: StatusCodes.OK,
      body: { data: { items: [{ id: VARIANT_ID }] } },
    });

    const result = await bootstrapAnonymousSession(ctx, { taskId: TASK_ID });

    expect(listTaskVariants).toHaveBeenCalledWith({
      params: { taskId: TASK_ID },
      query: { perPage: 1, sortBy: 'createdAt', sortOrder: 'asc', status: 'published' },
    });
    expect(result).toEqual({ participantId: PARTICIPANT_ID, variantId: VARIANT_ID });
  });

  it('provisions the user before resolving the variant', async () => {
    const callOrder: string[] = [];
    createAnonymous.mockImplementation(async () => {
      callOrder.push('createAnonymous');
      return { status: StatusCodes.OK, body: { data: { id: PARTICIPANT_ID } } };
    });
    listTaskVariants.mockImplementation(async () => {
      callOrder.push('listTaskVariants');
      return { status: StatusCodes.OK, body: { data: { items: [{ id: VARIANT_ID }] } } };
    });

    await bootstrapAnonymousSession(ctx, { taskId: TASK_ID });

    expect(callOrder).toEqual(['createAnonymous', 'listTaskVariants']);
  });

  it('throws BOOTSTRAP_FAILED when provisioning fails', async () => {
    createAnonymous.mockResolvedValue({
      status: StatusCodes.UNAUTHORIZED,
      body: { error: { message: 'Unauthorized' } },
    });

    await expect(bootstrapAnonymousSession(ctx)).rejects.toMatchObject({
      message: 'Unauthorized',
      code: SdkErrorCode.BOOTSTRAP_FAILED,
    });
    await expect(bootstrapAnonymousSession(ctx)).rejects.toBeInstanceOf(SDKError);
  });

  it('throws BOOTSTRAP_FAILED when variant lookup fails', async () => {
    listTaskVariants.mockResolvedValue({
      status: StatusCodes.NOT_FOUND,
      body: { error: { message: 'Task not found' } },
    });

    await expect(bootstrapAnonymousSession(ctx, { taskId: TASK_ID })).rejects.toMatchObject({
      message: 'Task not found',
      code: SdkErrorCode.BOOTSTRAP_FAILED,
    });
  });

  it('throws BOOTSTRAP_FAILED when no published variant exists', async () => {
    listTaskVariants.mockResolvedValue({
      status: StatusCodes.OK,
      body: { data: { items: [] } },
    });

    await expect(bootstrapAnonymousSession(ctx, { taskId: TASK_ID })).rejects.toMatchObject({
      code: SdkErrorCode.BOOTSTRAP_FAILED,
    });
  });
});
