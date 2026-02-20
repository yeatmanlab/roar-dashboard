import { describe, it, expect } from 'vitest';
import { RunTrialsRepository } from './run-trials.repository';

/**
 * RunTrialsRepository Tests
 *
 * Tests the data access layer for run trials.
 * Verifies that the repository properly extends BaseRepository
 * and has access to standard CRUD operations.
 */
describe('RunTrialsRepository', () => {
  it('should be instantiable', () => {
    const repository = new RunTrialsRepository();

    expect(repository).toBeDefined();
    expect(repository).toBeInstanceOf(RunTrialsRepository);
  });

  it('should have standard repository methods', () => {
    const repository = new RunTrialsRepository();

    expect(typeof repository.create).toBe('function');
    expect(typeof repository.getById).toBe('function');
    expect(typeof repository.update).toBe('function');
    expect(typeof repository.delete).toBe('function');
  });

  it('should have transaction support', () => {
    const repository = new RunTrialsRepository();

    expect(typeof repository.runTransaction).toBe('function');
  });
});
