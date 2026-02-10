/**
 * Integration tests for RunsRepository.
 *
 * Tests the `getRunStatsByAdministrationIds` method against the real
 * assessment database. Uses RunFactory to create test runs.
 *
 * Note: The assessment DB has no FK constraints to the core DB, so we
 * use arbitrary UUIDs for userId/taskId/taskVariantId and fixture
 * administration IDs where convenient.
 */
import { describe, it, expect } from 'vitest';
import { faker } from '@faker-js/faker';
import { baseFixture } from '../test-support/fixtures';
import { RunFactory } from '../test-support/factories/run.factory';
import { RunsRepository } from './runs.repository';

describe('RunsRepository', () => {
  const repository = new RunsRepository();

  describe('getRunStatsByAdministrationIds', () => {
    it('returns empty map for empty input array', async () => {
      const result = await repository.getRunStatsByAdministrationIds([]);

      expect(result).toEqual(new Map());
    });

    it('returns stats with correct started/completed counts', async () => {
      const administrationId = baseFixture.administrationAssignedToDistrict.id;
      const user1 = faker.string.uuid();
      const user2 = faker.string.uuid();
      const user3 = faker.string.uuid();

      // user1: started but not completed
      await RunFactory.create({ userId: user1, administrationId, completedAt: null });

      // user2: completed
      await RunFactory.create({ userId: user2, administrationId, completedAt: new Date() });

      // user3: started but not completed
      await RunFactory.create({ userId: user3, administrationId, completedAt: null });

      const result = await repository.getRunStatsByAdministrationIds([administrationId]);

      const stats = result.get(administrationId);
      expect(stats).toBeDefined();
      expect(stats!.started).toBe(3);
      expect(stats!.completed).toBe(1);
    });

    it('handles multiple administrations', async () => {
      const adminA = faker.string.uuid();
      const adminB = faker.string.uuid();
      const user1 = faker.string.uuid();
      const user2 = faker.string.uuid();

      // Admin A: 2 users started, 1 completed
      await RunFactory.create({ userId: user1, administrationId: adminA, completedAt: new Date() });
      await RunFactory.create({ userId: user2, administrationId: adminA, completedAt: null });

      // Admin B: 1 user started and completed
      await RunFactory.create({ userId: user1, administrationId: adminB, completedAt: new Date() });

      const result = await repository.getRunStatsByAdministrationIds([adminA, adminB]);

      expect(result.size).toBe(2);
      expect(result.get(adminA)).toEqual({ started: 2, completed: 1 });
      expect(result.get(adminB)).toEqual({ started: 1, completed: 1 });
    });

    it('omits administrations with no runs', async () => {
      const adminWithRuns = faker.string.uuid();
      const adminWithoutRuns = faker.string.uuid();

      await RunFactory.create({ userId: faker.string.uuid(), administrationId: adminWithRuns, completedAt: null });

      const result = await repository.getRunStatsByAdministrationIds([adminWithRuns, adminWithoutRuns]);

      expect(result.has(adminWithRuns)).toBe(true);
      expect(result.has(adminWithoutRuns)).toBe(false);
    });

    it('handles zero completed correctly', async () => {
      const administrationId = faker.string.uuid();
      const user1 = faker.string.uuid();
      const user2 = faker.string.uuid();

      // Both users started but neither completed
      await RunFactory.create({ userId: user1, administrationId, completedAt: null });
      await RunFactory.create({ userId: user2, administrationId, completedAt: null });

      const result = await repository.getRunStatsByAdministrationIds([administrationId]);

      const stats = result.get(administrationId);
      expect(stats).toBeDefined();
      expect(stats!.started).toBe(2);
      expect(stats!.completed).toBe(0);
    });

    it('counts distinct users (multiple runs per user count as one)', async () => {
      const administrationId = faker.string.uuid();
      const userId = faker.string.uuid();

      // Same user, multiple runs, one completed
      await RunFactory.create({ userId, administrationId, completedAt: null });
      await RunFactory.create({ userId, administrationId, completedAt: new Date() });
      await RunFactory.create({ userId, administrationId, completedAt: null });

      const result = await repository.getRunStatsByAdministrationIds([administrationId]);

      const stats = result.get(administrationId);
      expect(stats).toBeDefined();
      // Only 1 distinct user
      expect(stats!.started).toBe(1);
      expect(stats!.completed).toBe(1);
    });
  });
});
