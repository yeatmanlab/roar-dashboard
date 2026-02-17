import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@google-cloud/cloud-sql-connector', () => ({
  Connector: vi.fn().mockImplementation(() => ({
    getOptions: vi.fn().mockResolvedValue({ host: 'mock-host', port: 5432 }),
    close: vi.fn(),
  })),
  AuthTypes: { IAM: 'IAM' },
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn().mockReturnValue({ mockDrizzleClient: true }),
  NodePgDatabase: vi.fn(),
}));

vi.mock('./schema/core', () => ({}));
vi.mock('./schema/assessment', () => ({}));
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { Pool } from 'pg';
import { Connector } from '@google-cloud/cloud-sql-connector';
import { drizzle } from 'drizzle-orm/node-postgres';

const PoolMock = Pool as unknown as Mock;
const ConnectorMock = Connector as unknown as Mock;
const drizzleMock = drizzle as unknown as Mock;

const clearEnv = () => {
  delete process.env.USE_CLOUDSQL_CONNECTOR;
  delete process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME;
  delete process.env.CORE_DATABASE_NAME;
  delete process.env.CORE_DATABASE_USER;
  delete process.env.ASSESSMENT_DATABASE_NAME;
  delete process.env.ASSESSMENT_DATABASE_USER;
  delete process.env.CORE_DATABASE_URL;
  delete process.env.ASSESSMENT_DATABASE_URL;
};

describe('clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearEnv();
    vi.resetModules();
  });

  afterEach(async () => {
    // Clean up by closing pools if initialized
    try {
      const { closeDatabasePools } = await import('./clients');
      await closeDatabasePools();
    } catch {
      // Ignore errors during cleanup
    }
    clearEnv();
  });

  describe('initializeDatabasePools', () => {
    describe('local password auth', () => {
      it('creates pools with connection strings when USE_CLOUDSQL_CONNECTOR is not set', async () => {
        process.env.CORE_DATABASE_URL = 'postgresql://localhost:5432/core';
        process.env.ASSESSMENT_DATABASE_URL = 'postgresql://localhost:5432/assessment';

        const clients = await import('./clients');
        await clients.initializeDatabasePools();

        expect(PoolMock).toHaveBeenCalledTimes(2);
        expect(PoolMock).toHaveBeenCalledWith({
          connectionString: 'postgresql://localhost:5432/core',
        });
        expect(PoolMock).toHaveBeenCalledWith({
          connectionString: 'postgresql://localhost:5432/assessment',
        });
        expect(ConnectorMock).not.toHaveBeenCalled();
        expect(drizzleMock).toHaveBeenCalledTimes(2);
        expect(clients.CoreDbClient).toBeDefined();
        expect(clients.AssessmentDbClient).toBeDefined();
      });

      it('throws error when CORE_DATABASE_URL is missing', async () => {
        process.env.ASSESSMENT_DATABASE_URL = 'postgresql://localhost:5432/assessment';

        const { initializeDatabasePools } = await import('./clients');

        await expect(initializeDatabasePools()).rejects.toThrow('CORE_DATABASE_URL is required');
      });

      it('throws error when ASSESSMENT_DATABASE_URL is missing', async () => {
        process.env.CORE_DATABASE_URL = 'postgresql://localhost:5432/core';

        const { initializeDatabasePools } = await import('./clients');

        await expect(initializeDatabasePools()).rejects.toThrow('ASSESSMENT_DATABASE_URL is required');
      });
    });

    describe('Cloud SQL Connector', () => {
      it('creates pools with Cloud SQL Connector when USE_CLOUDSQL_CONNECTOR is true', async () => {
        process.env.USE_CLOUDSQL_CONNECTOR = 'true';
        process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME = 'project:region:instance';
        process.env.CORE_DATABASE_USER = 'core-user@project.iam';
        process.env.ASSESSMENT_DATABASE_USER = 'assessment-user@project.iam';

        const { initializeDatabasePools } = await import('./clients');
        await initializeDatabasePools();

        expect(ConnectorMock).toHaveBeenCalledTimes(1);
        expect(PoolMock).toHaveBeenCalledTimes(2);
        expect(PoolMock).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'mock-host',
            port: 5432,
            user: 'core-user@project.iam',
            database: 'core',
          }),
        );
        expect(PoolMock).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'mock-host',
            port: 5432,
            user: 'assessment-user@project.iam',
            database: 'assessment',
          }),
        );
      });

      it('uses custom database names when provided', async () => {
        process.env.USE_CLOUDSQL_CONNECTOR = 'true';
        process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME = 'project:region:instance';
        process.env.CORE_DATABASE_NAME = 'custom-core';
        process.env.CORE_DATABASE_USER = 'core-user@project.iam';
        process.env.ASSESSMENT_DATABASE_NAME = 'custom-assessment';
        process.env.ASSESSMENT_DATABASE_USER = 'assessment-user@project.iam';

        const { initializeDatabasePools } = await import('./clients');
        await initializeDatabasePools();

        expect(PoolMock).toHaveBeenCalledWith(
          expect.objectContaining({
            database: 'custom-core',
          }),
        );
        expect(PoolMock).toHaveBeenCalledWith(
          expect.objectContaining({
            database: 'custom-assessment',
          }),
        );
      });

      it('throws error when CLOUDSQL_INSTANCE_CONNECTION_NAME is missing', async () => {
        process.env.USE_CLOUDSQL_CONNECTOR = 'true';
        process.env.CORE_DATABASE_USER = 'core-user@project.iam';
        process.env.ASSESSMENT_DATABASE_USER = 'assessment-user@project.iam';

        const { initializeDatabasePools } = await import('./clients');

        await expect(initializeDatabasePools()).rejects.toThrow(
          'CLOUDSQL_INSTANCE_CONNECTION_NAME is required when USE_CLOUDSQL_CONNECTOR is enabled',
        );
      });

      it('throws error when CORE_DATABASE_USER is missing', async () => {
        process.env.USE_CLOUDSQL_CONNECTOR = 'true';
        process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME = 'project:region:instance';
        process.env.ASSESSMENT_DATABASE_USER = 'assessment-user@project.iam';

        const { initializeDatabasePools } = await import('./clients');

        await expect(initializeDatabasePools()).rejects.toThrow(
          'CORE_DATABASE_USER is required when USE_CLOUDSQL_CONNECTOR is enabled',
        );
      });

      it('throws error when ASSESSMENT_DATABASE_USER is missing', async () => {
        process.env.USE_CLOUDSQL_CONNECTOR = 'true';
        process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME = 'project:region:instance';
        process.env.CORE_DATABASE_USER = 'core-user@project.iam';

        const { initializeDatabasePools } = await import('./clients');

        await expect(initializeDatabasePools()).rejects.toThrow(
          'ASSESSMENT_DATABASE_USER is required when USE_CLOUDSQL_CONNECTOR is enabled',
        );
      });
    });

    it('is idempotent - subsequent calls are no-ops', async () => {
      process.env.CORE_DATABASE_URL = 'postgresql://localhost:5432/core';
      process.env.ASSESSMENT_DATABASE_URL = 'postgresql://localhost:5432/assessment';

      const { initializeDatabasePools } = await import('./clients');

      await initializeDatabasePools();
      await initializeDatabasePools();
      await initializeDatabasePools();

      expect(PoolMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('closeDatabasePools', () => {
    it('closes pools and resets state', async () => {
      process.env.CORE_DATABASE_URL = 'postgresql://localhost:5432/core';
      process.env.ASSESSMENT_DATABASE_URL = 'postgresql://localhost:5432/assessment';

      const { initializeDatabasePools, closeDatabasePools } = await import('./clients');

      await initializeDatabasePools();
      const poolInstances = PoolMock.mock.results.map((r: { value: unknown }) => r.value) as Array<{
        end: ReturnType<typeof vi.fn>;
      }>;

      await closeDatabasePools();

      for (const pool of poolInstances) {
        expect(pool.end).toHaveBeenCalled();
      }
    });

    it('closes Cloud SQL Connector when used', async () => {
      process.env.USE_CLOUDSQL_CONNECTOR = 'true';
      process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME = 'project:region:instance';
      process.env.CORE_DATABASE_USER = 'core-user@project.iam';
      process.env.ASSESSMENT_DATABASE_USER = 'assessment-user@project.iam';

      const { initializeDatabasePools, closeDatabasePools } = await import('./clients');

      await initializeDatabasePools();
      const connectorInstance = ConnectorMock.mock.results[0]?.value as { close: ReturnType<typeof vi.fn> };

      await closeDatabasePools();

      expect(connectorInstance.close).toHaveBeenCalled();
    });

    it('allows re-initialization after close', async () => {
      process.env.CORE_DATABASE_URL = 'postgresql://localhost:5432/core';
      process.env.ASSESSMENT_DATABASE_URL = 'postgresql://localhost:5432/assessment';

      const { initializeDatabasePools, closeDatabasePools } = await import('./clients');

      await initializeDatabasePools();
      expect(PoolMock).toHaveBeenCalledTimes(2);

      await closeDatabasePools();

      await initializeDatabasePools();
      expect(PoolMock).toHaveBeenCalledTimes(4);
    });
  });
});
