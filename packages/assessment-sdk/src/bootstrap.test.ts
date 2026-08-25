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
      query: { perPage: 100, sortBy: 'createdAt', sortOrder: 'asc', status: 'published' },
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

  describe('defaultVariantName', () => {
    const OTHER_VARIANT_ID = '33333333-3333-3333-3333-333333333333';

    /** Oldest first, matching the query's `sortOrder: 'asc'`. */
    const publish = (...items: { id: string; name: string | null }[]) =>
      listTaskVariants.mockResolvedValue({ status: StatusCodes.OK, body: { data: { items } } });

    it('resolves the named variant rather than the oldest', async () => {
      publish({ id: OTHER_VARIANT_ID, name: 'Old (v1)' }, { id: VARIANT_ID, name: 'English (v7)' });

      const result = await bootstrapAnonymousSession(ctx, {
        taskId: TASK_ID,
        defaultVariantName: 'English (v7)',
      });

      expect(result.variantId).toBe(VARIANT_ID);
    });

    it('matches the name case-insensitively, mirroring the lower(name) unique index', async () => {
      publish({ id: VARIANT_ID, name: 'English (v7)' });

      const result = await bootstrapAnonymousSession(ctx, {
        taskId: TASK_ID,
        defaultVariantName: 'ENGLISH (V7)',
      });

      expect(result.variantId).toBe(VARIANT_ID);
    });

    it('throws by default when the named variant is not published, listing what is', async () => {
      publish({ id: OTHER_VARIANT_ID, name: 'Spanish (v1)' });

      await expect(
        bootstrapAnonymousSession(ctx, { taskId: TASK_ID, defaultVariantName: 'English (v7)' }),
      ).rejects.toMatchObject({
        code: SdkErrorCode.BOOTSTRAP_FAILED,
        message: expect.stringContaining('Spanish (v1)'),
      });
    });

    it('falls back with a warning when onUnresolvedDefault is fallback', async () => {
      publish({ id: OTHER_VARIANT_ID, name: 'Spanish (v1)' }, { id: VARIANT_ID, name: 'Italian' });
      const warn = vi.fn();

      const result = await bootstrapAnonymousSession(
        { ...ctx, logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() } },
        { taskId: TASK_ID, defaultVariantName: 'English (v7)', onUnresolvedDefault: 'fallback' },
      );

      // Oldest published variant, i.e. the pre-existing behaviour.
      expect(result.variantId).toBe(OTHER_VARIANT_ID);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('English (v7)'));
    });

    it('warns when no name is declared and several variants are published', async () => {
      publish({ id: OTHER_VARIANT_ID, name: 'Old (v1)' }, { id: VARIANT_ID, name: 'New (v2)' });
      const warn = vi.fn();

      const result = await bootstrapAnonymousSession(
        { ...ctx, logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() } },
        { taskId: TASK_ID },
      );

      expect(result.variantId).toBe(OTHER_VARIANT_ID);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('No default variant declared'));
    });

    it('does not warn when no name is declared and only one variant is published', async () => {
      publish({ id: VARIANT_ID, name: 'Only one' });
      const warn = vi.fn();

      const result = await bootstrapAnonymousSession(
        { ...ctx, logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() } },
        { taskId: TASK_ID },
      );

      expect(result.variantId).toBe(VARIANT_ID);
      expect(warn).not.toHaveBeenCalled();
    });

    it('is ignored when an explicit variantId is supplied', async () => {
      const result = await bootstrapAnonymousSession(ctx, {
        variantId: VARIANT_ID,
        taskId: TASK_ID,
        defaultVariantName: 'does-not-exist',
      });

      expect(result.variantId).toBe(VARIANT_ID);
      expect(listTaskVariants).not.toHaveBeenCalled();
    });
    it('warns when the published-variant lookup was truncated', async () => {
      // A name published beyond the first page cannot match, so the truncation must be
      // visible rather than silently resolving to the oldest.
      listTaskVariants.mockResolvedValue({
        status: StatusCodes.OK,
        body: { data: { items: [{ id: VARIANT_ID, name: 'Only page one' }], pagination: { totalPages: 2 } } },
      });
      const warn = vi.fn();

      await bootstrapAnonymousSession(
        { ...ctx, logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() } },
        { taskId: TASK_ID, defaultVariantName: 'Only page one' },
      );

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('only the first page'));
    });
  });
});
