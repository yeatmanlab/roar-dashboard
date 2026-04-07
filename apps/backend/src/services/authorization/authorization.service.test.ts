import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { OpenFgaClient, TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../../logger';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import type { MockFgaClient } from '../../test-support/clients/fga.client';
import { createMockFgaClient } from '../../test-support/clients/fga.client';
import { AuthorizationService } from './authorization.service';

let mockClient: MockFgaClient;

beforeEach(() => {
  mockClient = createMockFgaClient();
});

const sampleTuples: TupleKey[] = [
  {
    user: 'user:abc',
    relation: 'teacher',
    object: 'school:def',
    condition: {
      name: 'active_membership',
      context: { grant_start: '2024-01-01T00:00:00.000Z', grant_end: '9999-12-31T23:59:59Z' },
    },
  },
];

const sampleTuplesWithoutCondition: TupleKeyWithoutCondition[] = [
  {
    user: 'district:abc',
    relation: 'parent_org',
    object: 'school:def',
  },
];

describe('AuthorizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('writeTuples', () => {
    it('skips the SDK call when given an empty array', async () => {
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.writeTuples([]);

      expect(mockClient.writeTuples).not.toHaveBeenCalled();
    });

    it('calls client.writeTuples with the provided tuples', async () => {
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.writeTuples(sampleTuples);

      expect(mockClient.writeTuples).toHaveBeenCalledWith(sampleTuples);
    });

    it('logs at debug level on success', async () => {
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.writeTuples(sampleTuples);

      expect(logger.debug).toHaveBeenCalledWith({ tupleCount: 1 }, 'FGA tuples written successfully');
    });

    it('logs error and does not throw on SDK failure', async () => {
      const sdkError = new Error('FGA write failed');
      mockClient.writeTuples.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.writeTuples(sampleTuples)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ err: sdkError, tupleCount: 1 }, 'Failed to write FGA tuples');
    });
  });

  describe('deleteTuples', () => {
    it('skips the SDK call when given an empty array', async () => {
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.deleteTuples([]);

      expect(mockClient.deleteTuples).not.toHaveBeenCalled();
    });

    it('calls client.deleteTuples with the provided tuples', async () => {
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.deleteTuples(sampleTuplesWithoutCondition);

      expect(mockClient.deleteTuples).toHaveBeenCalledWith(sampleTuplesWithoutCondition);
    });

    it('logs at debug level on success', async () => {
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.deleteTuples(sampleTuplesWithoutCondition);

      expect(logger.debug).toHaveBeenCalledWith({ tupleCount: 1 }, 'FGA tuples deleted successfully');
    });

    it('logs error and does not throw on SDK failure', async () => {
      const sdkError = new Error('FGA delete failed');
      mockClient.deleteTuples.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.deleteTuples(sampleTuplesWithoutCondition)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ err: sdkError, tupleCount: 1 }, 'Failed to delete FGA tuples');
    });
  });

  describe('hasPermission', () => {
    it('returns true when client.check returns allowed: true', async () => {
      mockClient.check.mockResolvedValueOnce({ allowed: true });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const result = await service.hasPermission('user-123', 'can_read', 'administration:admin-456');

      expect(result).toBe(true);
      expect(mockClient.check).toHaveBeenCalledWith({
        user: 'user:user-123',
        relation: 'can_read',
        object: 'administration:admin-456',
        context: { current_time: expect.any(String) },
      });
    });

    it('returns false when client.check returns allowed: false', async () => {
      mockClient.check.mockResolvedValueOnce({ allowed: false });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const result = await service.hasPermission('user-123', 'can_read', 'administration:admin-456');

      expect(result).toBe(false);
    });

    it('returns false when client.check returns allowed: undefined', async () => {
      mockClient.check.mockResolvedValueOnce({});
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const result = await service.hasPermission('user-123', 'can_read', 'administration:admin-456');

      expect(result).toBe(false);
    });

    it('propagates errors from the FGA client', async () => {
      const sdkError = new Error('FGA check failed');
      mockClient.check.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.hasPermission('user-123', 'can_read', 'administration:admin-456')).rejects.toThrow(
        'FGA check failed',
      );
    });
  });

  describe('requirePermission', () => {
    it('does not throw when the user has the permission', async () => {
      mockClient.check.mockResolvedValueOnce({ allowed: true });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(
        service.requirePermission('user-123', 'can_read', 'administration:admin-456'),
      ).resolves.toBeUndefined();
    });

    it('throws FORBIDDEN ApiError when the user lacks the permission', async () => {
      mockClient.check.mockResolvedValueOnce({ allowed: false });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.requirePermission('user-123', 'can_delete', 'administration:admin-456')).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.FORBIDDEN,
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );
    });

    it('logs a warning when permission is denied', async () => {
      mockClient.check.mockResolvedValueOnce({ allowed: false });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.requirePermission('user-123', 'can_delete', 'administration:admin-456').catch(() => {});

      expect(logger.warn).toHaveBeenCalledWith(
        { userId: 'user-123', relation: 'can_delete', object: 'administration:admin-456' },
        'FGA permission check denied',
      );
    });

    it('propagates errors from the FGA client', async () => {
      const sdkError = new Error('FGA check failed');
      mockClient.check.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.requirePermission('user-123', 'can_read', 'administration:admin-456')).rejects.toThrow(
        'FGA check failed',
      );
    });

    it('includes context in the thrown ApiError', async () => {
      mockClient.check.mockResolvedValueOnce({ allowed: false });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      try {
        await service.requirePermission('user-123', 'can_delete', 'administration:admin-456');
        expect.fail('Expected requirePermission to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.context).toEqual({
          userId: 'user-123',
          relation: 'can_delete',
          object: 'administration:admin-456',
        });
      }
    });
  });

  describe('listAccessibleObjects', () => {
    it('returns object IDs from the FGA client', async () => {
      const objects = ['administration:aaa', 'administration:bbb'];
      mockClient.listObjects.mockResolvedValueOnce({ objects });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const result = await service.listAccessibleObjects('user-123', 'can_read', 'administration');

      expect(result).toEqual(objects);
      expect(mockClient.listObjects).toHaveBeenCalledWith({
        user: 'user:user-123',
        relation: 'can_read',
        type: 'administration',
        context: { current_time: expect.any(String) },
      });
    });

    it('returns an empty array when no objects are accessible', async () => {
      mockClient.listObjects.mockResolvedValueOnce({ objects: [] });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const result = await service.listAccessibleObjects('user-123', 'can_read', 'administration');

      expect(result).toEqual([]);
    });

    it('propagates errors from the FGA client', async () => {
      const sdkError = new Error('FGA listObjects failed');
      mockClient.listObjects.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.listAccessibleObjects('user-123', 'can_read', 'administration')).rejects.toThrow(
        'FGA listObjects failed',
      );
    });
  });
});
