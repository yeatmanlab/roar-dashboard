import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { OpenFgaClient, TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import { logger } from '../../logger';
import type { MockFgaClient } from '../../test-support/clients/fga.client';
import { createMockFgaClient } from '../../test-support/clients/fga.client';
import { AuthorizationService } from './authorization.service';

let mockClient: MockFgaClient;

beforeEach(() => {
  mockClient = createMockFgaClient();
});

// Safe cast: the service only calls writeTuples/deleteTuples, which the mock provides
const getClient = () => mockClient as unknown as OpenFgaClient;

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
      const service = AuthorizationService({ getClient });

      await service.writeTuples([]);

      expect(mockClient.writeTuples).not.toHaveBeenCalled();
    });

    it('calls client.writeTuples with the provided tuples', async () => {
      const service = AuthorizationService({ getClient });

      await service.writeTuples(sampleTuples);

      expect(mockClient.writeTuples).toHaveBeenCalledWith(sampleTuples);
    });

    it('logs at debug level on success', async () => {
      const service = AuthorizationService({ getClient });

      await service.writeTuples(sampleTuples);

      expect(logger.debug).toHaveBeenCalledWith({ tupleCount: 1 }, 'FGA tuples written successfully');
    });

    it('logs error and does not throw on SDK failure', async () => {
      const sdkError = new Error('FGA write failed');
      mockClient.writeTuples.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ getClient });

      await expect(service.writeTuples(sampleTuples)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ err: sdkError, tupleCount: 1 }, 'Failed to write FGA tuples');
    });
  });

  describe('deleteTuples', () => {
    it('skips the SDK call when given an empty array', async () => {
      const service = AuthorizationService({ getClient });

      await service.deleteTuples([]);

      expect(mockClient.deleteTuples).not.toHaveBeenCalled();
    });

    it('calls client.deleteTuples with the provided tuples', async () => {
      const service = AuthorizationService({ getClient });

      await service.deleteTuples(sampleTuplesWithoutCondition);

      expect(mockClient.deleteTuples).toHaveBeenCalledWith(sampleTuplesWithoutCondition);
    });

    it('logs at debug level on success', async () => {
      const service = AuthorizationService({ getClient });

      await service.deleteTuples(sampleTuplesWithoutCondition);

      expect(logger.debug).toHaveBeenCalledWith({ tupleCount: 1 }, 'FGA tuples deleted successfully');
    });

    it('logs error and does not throw on SDK failure', async () => {
      const sdkError = new Error('FGA delete failed');
      mockClient.deleteTuples.mockRejectedValueOnce(sdkError);
      const service = AuthorizationService({ getClient });

      await expect(service.deleteTuples(sampleTuplesWithoutCondition)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ err: sdkError, tupleCount: 1 }, 'Failed to delete FGA tuples');
    });
  });
});
