/**
 * Integration tests for ClassRepository.
 *
 * Currently only tests BaseRepository methods against the `class` table.
 */
import { describe, it, expect } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { ClassRepository } from './class.repository';

describe('ClassRepository', () => {
  const repository = new ClassRepository();

  describe('getById (inherited', () => {
    it('returns class', async () => {
      const result = await repository.getById({ id: baseFixture.classInSchoolA.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.classInSchoolA.id);
    });

    it('returns null for nonexistent class', async () => {
      const result = await repository.getById({ id: 'nonexistent-class-id-xyz' });

      expect(result).toBeNull();
    });

    // TODO: Update tests to include authorization logic
  });
});
