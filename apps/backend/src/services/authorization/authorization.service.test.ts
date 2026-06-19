import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { OpenFgaClient, TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../../logger';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import type { MockFgaClient } from '../../test-support/clients/fga.client';
import {
  createMockFgaClient,
  mockStreamedListObjects,
  mockStreamedListObjectsError,
} from '../../test-support/clients/fga.client';
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

  describe('writeTuplesOrThrow', () => {
    it('skips the SDK call when given an empty array', async () => {
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.writeTuplesOrThrow([]);

      expect(mockClient.writeTuples).not.toHaveBeenCalled();
    });

    it('calls client.writeTuples with the provided tuples', async () => {
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.writeTuplesOrThrow(sampleTuples);

      expect(mockClient.writeTuples).toHaveBeenCalledWith(sampleTuples);
    });

    it('logs at debug level on success', async () => {
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.writeTuplesOrThrow(sampleTuples);

      expect(logger.debug).toHaveBeenCalledWith({ tupleCount: 1 }, 'FGA tuples written successfully');
    });

    it('throws ApiError with EXTERNAL_SERVICE_FAILED on SDK failure', async () => {
      const sdkError = new Error('FGA write failed');
      mockClient.writeTuples.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.writeTuplesOrThrow(sampleTuples)).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        }),
      );
    });

    it('logs error when SDK fails', async () => {
      const sdkError = new Error('FGA write failed');
      mockClient.writeTuples.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.writeTuplesOrThrow(sampleTuples).catch(() => {});

      expect(logger.error).toHaveBeenCalledWith({ err: sdkError, tupleCount: 1 }, 'Failed to write FGA tuples');
    });

    it('includes tuple count in error context', async () => {
      const sdkError = new Error('FGA write failed');
      mockClient.writeTuples.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      let thrownError: unknown;
      try {
        await service.writeTuplesOrThrow(sampleTuples);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ApiError);
      const apiError = thrownError as ApiError;
      expect(apiError.context).toEqual({ tupleCount: 1 });
      expect(apiError.cause).toBe(sdkError);
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

    it('wraps FGA client errors in ApiError with EXTERNAL_SERVICE_FAILED', async () => {
      const sdkError = new Error('FGA check failed');
      mockClient.check.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.hasPermission('user-123', 'can_read', 'administration:admin-456')).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        }),
      );
    });

    it('logs error when FGA client fails', async () => {
      const sdkError = new Error('FGA check failed');
      mockClient.check.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.hasPermission('user-123', 'can_read', 'administration:admin-456').catch(() => {});

      expect(logger.error).toHaveBeenCalledWith(
        { err: sdkError, context: { userId: 'user-123', relation: 'can_read', object: 'administration:admin-456' } },
        'FGA permission check failed',
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

    it('wraps FGA client errors in ApiError with EXTERNAL_SERVICE_FAILED', async () => {
      const sdkError = new Error('FGA check failed');
      mockClient.check.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.requirePermission('user-123', 'can_read', 'administration:admin-456')).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        }),
      );
    });

    it('includes context in the thrown ApiError', async () => {
      mockClient.check.mockResolvedValueOnce({ allowed: false });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      let thrownError: unknown;
      try {
        await service.requirePermission('user-123', 'can_delete', 'administration:admin-456');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ApiError);
      const apiError = thrownError as ApiError;
      expect(apiError.context).toEqual({
        userId: 'user-123',
        relation: 'can_delete',
        object: 'administration:admin-456',
      });
    });
  });

  describe('hasAnyPermission', () => {
    it('returns false without calling the SDK when the objects array is empty', async () => {
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const result = await service.hasAnyPermission('user-123', 'can_read', []);

      expect(result).toBe(false);
      expect(mockClient.batchCheck).not.toHaveBeenCalled();
    });

    it('returns true when at least one batch check is allowed', async () => {
      mockClient.batchCheck.mockResolvedValueOnce({
        result: [{ allowed: false }, { allowed: true }],
      });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const result = await service.hasAnyPermission('user-123', 'can_read', [
        'administration:aaa',
        'administration:bbb',
      ]);

      expect(result).toBe(true);
      expect(mockClient.batchCheck).toHaveBeenCalledWith({
        checks: [
          {
            user: 'user:user-123',
            relation: 'can_read',
            object: 'administration:aaa',
            context: { current_time: expect.any(String) },
          },
          {
            user: 'user:user-123',
            relation: 'can_read',
            object: 'administration:bbb',
            context: { current_time: expect.any(String) },
          },
        ],
      });
    });

    it('returns false when no batch check is allowed', async () => {
      mockClient.batchCheck.mockResolvedValueOnce({
        result: [{ allowed: false }, { allowed: false }],
      });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const result = await service.hasAnyPermission('user-123', 'can_read', [
        'administration:aaa',
        'administration:bbb',
      ]);

      expect(result).toBe(false);
    });

    it('returns false when batch check results have no `allowed` property set', async () => {
      // FGA returns omitted `allowed` for deny — exercises the `=== true` strictness
      // in the production code (so `undefined` is correctly treated as false).
      mockClient.batchCheck.mockResolvedValueOnce({
        result: [{}, {}],
      });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const result = await service.hasAnyPermission('user-123', 'can_read', ['administration:aaa']);

      expect(result).toBe(false);
    });

    it('wraps batch check errors in ApiError with EXTERNAL_SERVICE_FAILED', async () => {
      const sdkError = new Error('FGA batch check failed');
      mockClient.batchCheck.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.hasAnyPermission('user-123', 'can_read', ['administration:aaa'])).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        }),
      );
    });

    it('logs error context when the batch check fails', async () => {
      const sdkError = new Error('FGA batch check failed');
      mockClient.batchCheck.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service
        .hasAnyPermission('user-123', 'can_read', ['administration:aaa', 'administration:bbb'])
        .catch(() => {});

      expect(logger.error).toHaveBeenCalledWith(
        { err: sdkError, context: { userId: 'user-123', relation: 'can_read', objectCount: 2 } },
        'FGA batch check failed',
      );
    });

    it('includes context in the thrown ApiError', async () => {
      const sdkError = new Error('FGA batch check failed');
      mockClient.batchCheck.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      let thrownError: unknown;
      try {
        await service.hasAnyPermission('user-123', 'can_read', ['administration:aaa', 'administration:bbb']);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ApiError);
      const apiError = thrownError as ApiError;
      expect(apiError.context).toEqual({
        userId: 'user-123',
        relation: 'can_read',
        objectCount: 2,
      });
      expect(apiError.cause).toBe(sdkError);
    });
  });

  describe('listAccessibleObjects', () => {
    it('collects streamed object IDs into an array', async () => {
      const objects = ['administration:aaa', 'administration:bbb'];
      mockStreamedListObjects(mockClient, objects);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const result = await service.listAccessibleObjects('user-123', 'can_read', 'administration');

      expect(result).toEqual(objects);
      expect(mockClient.streamedListObjects).toHaveBeenCalledWith({
        user: 'user:user-123',
        relation: 'can_read',
        type: 'administration',
        context: { current_time: expect.any(String) },
      });
    });

    it('returns an empty array when no objects are accessible', async () => {
      mockStreamedListObjects(mockClient, []);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const result = await service.listAccessibleObjects('user-123', 'can_read', 'administration');

      expect(result).toEqual([]);
    });

    it('does not call the deprecated listObjects API', async () => {
      mockStreamedListObjects(mockClient, ['administration:aaa']);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.listAccessibleObjects('user-123', 'can_read', 'administration');

      expect(mockClient.listObjects).not.toHaveBeenCalled();
    });

    it('wraps streamed-list errors in ApiError with EXTERNAL_SERVICE_FAILED', async () => {
      const sdkError = new Error('FGA streamedListObjects failed');
      mockStreamedListObjectsError(mockClient, sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.listAccessibleObjects('user-123', 'can_read', 'administration')).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        }),
      );
    });

    it('logs error when the FGA stream fails', async () => {
      const sdkError = new Error('FGA streamedListObjects failed');
      mockStreamedListObjectsError(mockClient, sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await service.listAccessibleObjects('user-123', 'can_read', 'administration').catch(() => {});

      expect(logger.error).toHaveBeenCalledWith(
        { err: sdkError, context: { userId: 'user-123', relation: 'can_read', type: 'administration' } },
        'FGA streamed list accessible objects failed',
      );
    });

    it('wraps synchronous SDK setup errors in ApiError with EXTERNAL_SERVICE_FAILED', async () => {
      // Simulate the SDK throwing before iteration begins (e.g., network setup,
      // bad credentials). The error is raised from `client.streamedListObjects(...)`
      // itself, not from a `for await` step.
      const sdkError = new Error('FGA streamedListObjects setup failed');
      mockClient.streamedListObjects.mockImplementation(() => {
        throw sdkError;
      });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(service.listAccessibleObjects('user-123', 'can_read', 'administration')).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        }),
      );
      expect(logger.error).toHaveBeenCalledWith(
        { err: sdkError, context: { userId: 'user-123', relation: 'can_read', type: 'administration' } },
        'FGA streamed list accessible objects failed',
      );
    });
  });

  describe('listAccessibleObjectsStreamed', () => {
    it('yields objects from the FGA stream as a generator', async () => {
      const objects = ['administration:aaa', 'administration:bbb', 'administration:ccc'];
      mockStreamedListObjects(mockClient, objects);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const collected: string[] = [];
      for await (const chunk of service.listAccessibleObjectsStreamed('user-123', 'can_read', 'administration')) {
        collected.push(chunk.object);
      }

      expect(collected).toEqual(objects);
    });

    it('passes current_time context to the SDK', async () => {
      mockStreamedListObjects(mockClient, ['administration:aaa']);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      // Drain the generator
      let count = 0;
      for await (const chunk of service.listAccessibleObjectsStreamed('user-123', 'can_read', 'administration')) {
        if (chunk.object) count += 1;
      }
      expect(count).toBe(1);

      expect(mockClient.streamedListObjects).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'user:user-123',
          relation: 'can_read',
          type: 'administration',
          context: { current_time: expect.any(String) },
        }),
      );
    });

    it('wraps iteration errors in ApiError with EXTERNAL_SERVICE_FAILED', async () => {
      const sdkError = new Error('FGA streamed iteration failed');
      mockStreamedListObjectsError(mockClient, sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(async () => {
        for await (const chunk of service.listAccessibleObjectsStreamed('user-123', 'can_read', 'administration')) {
          // touch chunk so the loop variable is used
          void chunk.object;
        }
      }).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        }),
      );
    });

    it('yields nothing when the FGA stream is empty', async () => {
      mockStreamedListObjects(mockClient, []);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      const collected: string[] = [];
      for await (const chunk of service.listAccessibleObjectsStreamed('user-123', 'can_read', 'administration')) {
        collected.push(chunk.object);
      }

      expect(collected).toEqual([]);
    });

    it('logs error context when the stream fails mid-iteration', async () => {
      const sdkError = new Error('FGA streamed iteration failed');
      mockStreamedListObjectsError(mockClient, sdkError);
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      try {
        for await (const chunk of service.listAccessibleObjectsStreamed('user-123', 'can_read', 'administration')) {
          void chunk.object;
        }
      } catch {
        // swallow — assertion is on the logger call
      }

      expect(logger.error).toHaveBeenCalledWith(
        { err: sdkError, context: { userId: 'user-123', relation: 'can_read', type: 'administration' } },
        'FGA streamed list accessible objects failed',
      );
    });

    it('wraps synchronous SDK setup errors in ApiError with EXTERNAL_SERVICE_FAILED', async () => {
      // The generator function awaits `client.streamedListObjects` lazily on first
      // iteration. If the SDK throws synchronously at call time, the error must still
      // be wrapped in ApiError when the consumer iterates.
      const sdkError = new Error('FGA streamedListObjects setup failed');
      mockClient.streamedListObjects.mockImplementation(() => {
        throw sdkError;
      });
      const service = AuthorizationService({ client: mockClient as unknown as OpenFgaClient });

      await expect(async () => {
        for await (const chunk of service.listAccessibleObjectsStreamed('user-123', 'can_read', 'administration')) {
          void chunk.object;
        }
      }).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        }),
      );
    });
  });
});
