import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { AgreementFactory } from '../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../test-support/factories/agreement-version.factory';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';
import type { AgreementEmbedOptionType } from '../enums/agreement-embed-option.enum';
import { AgreementService } from '../services/agreement/agreement.service';

// Mock the AgreementService module
vi.mock('../services/agreement/agreement.service', () => ({
  AgreementService: vi.fn(),
}));

/**
 * Type-safe assertion helper for success responses.
 * Asserts the status is OK and returns the data with proper typing.
 */
function expectOkResponse<T>(result: { status: number; body: { data: T } | { error: unknown } }): T {
  expect(result.status).toBe(StatusCodes.OK);
  expect(result.body).toHaveProperty('data');
  return (result.body as { data: T }).data;
}

/**
 * Type-safe assertion helper for error responses.
 */
function expectErrorResponse(
  result: { status: number; body: { data: unknown } | { error: unknown } },
  expectedStatus: number,
) {
  expect(result.status).toBe(expectedStatus);
  expect(result.body).toHaveProperty('error');
  return (result.body as { error: { message: string; code?: string; traceId?: string } }).error;
}

const defaultQuery = {
  page: 1,
  perPage: 25,
  sortBy: 'createdAt' as const,
  sortOrder: 'desc' as const,
  locale: 'en-US',
  embed: [] as AgreementEmbedOptionType[],
};

const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };

describe('AgreementsController', () => {
  const mockList = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AgreementService).mockReturnValue({ list: mockList });
  });

  describe('list', () => {
    it('returns 200 with paginated shape', async () => {
      mockList.mockResolvedValue({
        items: AgreementFactory.buildList(2).map((a) => ({ ...a, currentVersion: null })),
        totalItems: 2,
      });

      const { AgreementsController: Controller } = await import('./agreements.controller');

      const result = await Controller.list(mockAuthContext, defaultQuery);

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(2);
      expect(data.pagination).toEqual({ page: 1, perPage: 25, totalItems: 2, totalPages: 1 });
    });

    it('calculates totalPages correctly', async () => {
      mockList.mockResolvedValue({
        items: AgreementFactory.buildList(10).map((a) => ({ ...a, currentVersion: null })),
        totalItems: 95,
      });

      const { AgreementsController: Controller } = await import('./agreements.controller');

      const result = await Controller.list(mockAuthContext, { ...defaultQuery, perPage: 10 });

      const data = expectOkResponse(result);
      expect(data.pagination.totalPages).toBe(10); // ceil(95/10) = 10
    });

    it('transforms agreement fields to API response format', async () => {
      const version = AgreementVersionFactory.build({
        locale: 'en-US',
        githubFilename: 'TOS.md',
        githubOrgRepo: 'roar-org/legal-docs',
        githubCommitSha: 'abc123',
        createdAt: new Date('2024-03-01T00:00:00Z'),
      });
      const agreement = AgreementFactory.build({
        id: 'agreement-uuid',
        name: 'Terms of Service',
        agreementType: 'tos',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-02-01T00:00:00Z'),
      });
      mockList.mockResolvedValue({ items: [{ ...agreement, currentVersion: version }], totalItems: 1 });

      const { AgreementsController: Controller } = await import('./agreements.controller');

      const result = await Controller.list(mockAuthContext, defaultQuery);

      const data = expectOkResponse(result);
      const item = data.items[0]!;
      expect(item.id).toBe('agreement-uuid');
      expect(item.name).toBe('Terms of Service');
      expect(item.agreementType).toBe('tos');
      expect(item.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(item.updatedAt).toBe('2024-02-01T00:00:00.000Z');
      expect(item.currentVersion).toMatchObject({
        locale: 'en-US',
        githubFilename: 'TOS.md',
        githubOrgRepo: 'roar-org/legal-docs',
        githubCommitSha: 'abc123',
        createdAt: '2024-03-01T00:00:00.000Z',
      });
    });

    it('returns null updatedAt when updatedAt is null', async () => {
      const agreement = AgreementFactory.build({ updatedAt: null });
      mockList.mockResolvedValue({ items: [{ ...agreement, currentVersion: null }], totalItems: 1 });

      const { AgreementsController: Controller } = await import('./agreements.controller');

      const result = await Controller.list(mockAuthContext, defaultQuery);

      const data = expectOkResponse(result);
      expect(data.items[0]!.updatedAt).toBeNull();
    });

    it('returns null currentVersion when agreement has no current version', async () => {
      const agreement = AgreementFactory.build();
      mockList.mockResolvedValue({ items: [{ ...agreement, currentVersion: null }], totalItems: 1 });

      const { AgreementsController: Controller } = await import('./agreements.controller');

      const result = await Controller.list(mockAuthContext, defaultQuery);

      const data = expectOkResponse(result);
      expect(data.items[0]!.currentVersion).toBeNull();
    });

    it('includes versions in response when service returns them', async () => {
      const agreement = AgreementFactory.build();
      const versions = AgreementVersionFactory.buildList(2);
      mockList.mockResolvedValue({
        items: [{ ...agreement, currentVersion: versions[0]!, versions }],
        totalItems: 1,
      });

      const { AgreementsController: Controller } = await import('./agreements.controller');

      const result = await Controller.list(mockAuthContext, { ...defaultQuery, embed: ['versions'] });

      const data = expectOkResponse(result);
      expect(data.items[0]!.versions).toHaveLength(2);
    });

    it('does not include versions property when service does not return them', async () => {
      const agreement = AgreementFactory.build();
      mockList.mockResolvedValue({ items: [{ ...agreement, currentVersion: null }], totalItems: 1 });

      const { AgreementsController: Controller } = await import('./agreements.controller');

      const result = await Controller.list(mockAuthContext, defaultQuery);

      const data = expectOkResponse(result);
      expect(data.items[0]).not.toHaveProperty('versions');
    });

    it('returns empty items array when no agreements found', async () => {
      mockList.mockResolvedValue({ items: [], totalItems: 0 });

      const { AgreementsController: Controller } = await import('./agreements.controller');

      const result = await Controller.list(mockAuthContext, defaultQuery);

      const data = expectOkResponse(result);
      expect(data.items).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });

    it('passes auth context and query parameters to service', async () => {
      mockList.mockResolvedValue({ items: [], totalItems: 0 });

      const { AgreementsController: Controller } = await import('./agreements.controller');

      const authContext = { userId: 'user-456', isSuperAdmin: true };
      await Controller.list(authContext, {
        ...defaultQuery,
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        locale: 'es-MX',
        agreementType: 'consent',
      });

      expect(mockList).toHaveBeenCalledWith(authContext, {
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        locale: 'es-MX',
        embed: [],
        agreementType: 'consent',
      });
    });

    it('does not pass agreementType to service when not provided', async () => {
      mockList.mockResolvedValue({ items: [], totalItems: 0 });

      const { AgreementsController: Controller } = await import('./agreements.controller');

      await Controller.list(mockAuthContext, defaultQuery);

      expect(mockList).toHaveBeenCalledWith(
        mockAuthContext,
        expect.not.objectContaining({ agreementType: expect.anything() }),
      );
    });

    it('returns 500 when service throws an ApiError', async () => {
      const error = new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockList.mockRejectedValue(error);

      const { AgreementsController: Controller } = await import('./agreements.controller');

      const result = await Controller.list(mockAuthContext, defaultQuery);

      const errorBody = expectErrorResponse(result, StatusCodes.INTERNAL_SERVER_ERROR);
      expect(errorBody.message).toBe(ApiErrorMessage.INTERNAL_SERVER_ERROR);
      expect(errorBody.code).toBe(ApiErrorCode.DATABASE_QUERY_FAILED);
    });

    it('re-throws non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockList.mockRejectedValue(unexpectedError);

      const { AgreementsController: Controller } = await import('./agreements.controller');

      await expect(Controller.list(mockAuthContext, defaultQuery)).rejects.toThrow('Database connection lost');
    });
  });
});
