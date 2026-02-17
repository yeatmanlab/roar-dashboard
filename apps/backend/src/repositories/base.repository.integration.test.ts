/**
 * Integration tests for BaseRepository.
 *
 * Tests BaseRepository CRUD operations via UserRepository (concrete subclass)
 * against the real `users` table in the test database.
 *
 * These tests validate actual SQL correctness, pagination, ordering, and
 * transaction behavior — replacing the previous unit tests that mocked
 * the Drizzle query builder chain.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { baseFixture } from '../test-support/fixtures';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserRepository } from './user.repository';
import { users } from '../db/schema/core';

describe('BaseRepository', () => {
  let repository: UserRepository;

  beforeAll(() => {
    repository = new UserRepository();
  });

  describe('getById', () => {
    it('returns entity when found', async () => {
      const result = await repository.getById({ id: baseFixture.districtAdmin.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.districtAdmin.id);
      expect(result!.nameFirst).toBe(baseFixture.districtAdmin.nameFirst);
    });

    it('returns null for nonexistent ID', async () => {
      const result = await repository.getById({ id: '00000000-0000-0000-0000-000000000000' });

      expect(result).toBeNull();
    });
  });

  describe('get', () => {
    it('returns entity by id', async () => {
      const result = await repository.get({ id: baseFixture.schoolAStudent.id });

      expect(result).not.toBeNull();
      expect((result as { id: string }).id).toBe(baseFixture.schoolAStudent.id);
    });

    it('returns entities matching where condition', async () => {
      const result = await repository.get({
        where: eq(users.nameFirst, baseFixture.districtAdmin.nameFirst!),
      });

      expect(Array.isArray(result)).toBe(true);
      const results = result as Array<{ id: string; nameFirst: string }>;
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((u) => u.id === baseFixture.districtAdmin.id)).toBe(true);
    });

    it('respects limit with where clause', async () => {
      const result = await repository.get({
        where: eq(users.isSuperAdmin, false),
        limit: 2,
      });

      expect(Array.isArray(result)).toBe(true);
      expect((result as Array<unknown>).length).toBeLessThanOrEqual(2);
    });

    it('returns null when neither id nor where is provided', async () => {
      const result = await repository.get({});

      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('returns paginated results with correct totalItems', async () => {
      const result = await repository.getAll({ page: 1, perPage: 5 });

      expect(result.items.length).toBeLessThanOrEqual(5);
      // baseFixture creates 12 users
      expect(result.totalItems).toBeGreaterThanOrEqual(12);
    });

    it('returns sorted results ascending', async () => {
      const result = await repository.getAll({
        page: 1,
        perPage: 100,
        orderBy: { field: 'nameLast', direction: 'asc' },
      });

      expect(result.items.length).toBeGreaterThan(1);
      for (let i = 1; i < result.items.length; i++) {
        const prev = (result.items[i - 1]!.nameLast ?? '').toLowerCase();
        const curr = (result.items[i]!.nameLast ?? '').toLowerCase();
        expect(prev <= curr).toBe(true);
      }
    });

    it('returns sorted results descending', async () => {
      const result = await repository.getAll({
        page: 1,
        perPage: 100,
        orderBy: { field: 'nameLast', direction: 'desc' },
      });

      expect(result.items.length).toBeGreaterThan(1);
      for (let i = 1; i < result.items.length; i++) {
        const prev = (result.items[i - 1]!.nameLast ?? '').toLowerCase();
        const curr = (result.items[i]!.nameLast ?? '').toLowerCase();
        expect(prev >= curr).toBe(true);
      }
    });

    it('filters correctly with where clause', async () => {
      const result = await repository.getAll({
        page: 1,
        perPage: 100,
        where: eq(users.isSuperAdmin, true),
      });

      // No fixture users are super admins
      expect(result.totalItems).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('returns correct slice for page 2', async () => {
      const perPage = 3;
      const page1 = await repository.getAll({
        page: 1,
        perPage,
        orderBy: { field: 'nameFirst', direction: 'asc' },
      });
      const page2 = await repository.getAll({
        page: 2,
        perPage,
        orderBy: { field: 'nameFirst', direction: 'asc' },
      });

      // Page 1 and page 2 should have different items
      expect(page1.items.length).toBe(perPage);
      expect(page2.items.length).toBeGreaterThan(0);

      const page1Ids = new Set(page1.items.map((u) => u.id));
      const page2Ids = page2.items.map((u) => u.id);
      for (const id of page2Ids) {
        expect(page1Ids.has(id)).toBe(false);
      }

      // totalItems should be consistent
      expect(page1.totalItems).toBe(page2.totalItems);
    });

    it('returns empty items and 0 totalItems when no data matches', async () => {
      const result = await repository.getAll({
        page: 1,
        perPage: 10,
        where: eq(users.nameFirst, 'NonexistentNameXYZ12345'),
      });

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });
  });

  describe('create', () => {
    it('inserts and returns entity with generated ID', async () => {
      const userData = UserFactory.build();
      const result = await repository.create({ data: userData });

      if (!result) {
        throw new Error('Expected create to return a result');
      }
      expect(result).not.toBeNull();
      expect(result.id).toBeDefined();

      // Verify it was actually persisted
      const fetched = await repository.getById({ id: result.id });
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(result.id);
    });
  });

  describe('update', () => {
    it('modifies entity fields', async () => {
      const user = await UserFactory.create();
      const newName = 'UpdatedFirstName';

      await repository.update({ id: user.id, data: { nameFirst: newName } });

      const updated = await repository.getById({ id: user.id });
      expect(updated).not.toBeNull();
      expect(updated!.nameFirst).toBe(newName);
    });
  });

  describe('count', () => {
    it('returns total count', async () => {
      const result = await repository.count({});

      // baseFixture creates 12 users, tests may add more
      expect(result).toBeGreaterThanOrEqual(12);
    });

    it('returns filtered count with where clause', async () => {
      const result = await repository.count({
        where: eq(users.nameFirst, baseFixture.districtAdmin.nameFirst!),
      });

      expect(result).toBeGreaterThanOrEqual(1);
    });

    it('returns 0 when no data matches', async () => {
      const result = await repository.count({
        where: eq(users.nameFirst, 'NonexistentNameXYZ12345'),
      });

      expect(result).toBe(0);
    });
  });

  describe('runTransaction', () => {
    it('executes within transaction and commits', async () => {
      const user = UserFactory.build();

      const result = await repository.runTransaction({
        fn: async (tx) => {
          const [created] = await tx.insert(users).values(user).returning();
          return created;
        },
      });

      expect(result).not.toBeNull();
      expect(result.id).toBe(user.id);

      // Verify committed
      const fetched = await repository.getById({ id: user.id });
      expect(fetched).not.toBeNull();
    });

    it('rolls back on error', async () => {
      const user = UserFactory.build();

      await expect(
        repository.runTransaction({
          fn: async (tx) => {
            await tx.insert(users).values(user).returning();
            throw new Error('Intentional rollback');
          },
        }),
      ).rejects.toThrow('Intentional rollback');

      // Verify rolled back
      const fetched = await repository.getById({ id: user.id });
      expect(fetched).toBeNull();
    });
  });
});
