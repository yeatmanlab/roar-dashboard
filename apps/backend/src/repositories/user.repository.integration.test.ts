/**
 * Integration tests for UserRepository.
 *
 * Tests the custom `findByAuthId` method and light coverage of inherited
 * BaseRepository methods against the real `users` table.
 *
 * Thorough BaseRepository CRUD coverage is in base.repository.integration.test.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeAll(() => {
    repository = new UserRepository();
  });

  describe('findByAuthId', () => {
    it('returns user when found by authId', async () => {
      const result = await repository.findByAuthId(baseFixture.districtAdmin.authId!);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.districtAdmin.id);
      expect(result!.authId).toBe(baseFixture.districtAdmin.authId);
    });

    it('returns null for nonexistent authId', async () => {
      const result = await repository.findByAuthId('nonexistent-auth-id-xyz');

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('returns user', async () => {
      const result = await repository.getById({ id: baseFixture.schoolAStudent.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.schoolAStudent.id);
    });
  });

  describe('create (inherited)', () => {
    it('creates user', async () => {
      const userData = UserFactory.build();
      const result = await repository.create({ data: userData });

      if (!result) {
        throw new Error('Expected create to return a result');
      }

      expect(result).not.toBeNull();
      expect(result.id).toBeDefined();
    });
  });
});
