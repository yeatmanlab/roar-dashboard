import { describe, it, expect } from 'vitest';
import { RunScoresRepository } from './run-scores.repository';

/**
 * RunScoresRepository unit tests
 *
 * Smoke-level tests verifying that the repository extends BaseRepository
 * and exposes the upsertMany method. Behavioral tests live in the
 * integration suite where ON CONFLICT semantics can be exercised against
 * a real database.
 */
describe('RunScoresRepository', () => {
  it('should be instantiable', () => {
    const repository = new RunScoresRepository();

    expect(repository).toBeDefined();
    expect(repository).toBeInstanceOf(RunScoresRepository);
  });

  it('should have standard repository methods', () => {
    const repository = new RunScoresRepository();

    expect(typeof repository.create).toBe('function');
    expect(typeof repository.getById).toBe('function');
    expect(typeof repository.update).toBe('function');
    expect(typeof repository.delete).toBe('function');
    expect(typeof repository.runTransaction).toBe('function');
  });

  it('should expose upsertMany', () => {
    const repository = new RunScoresRepository();

    expect(typeof repository.upsertMany).toBe('function');
  });

  it('upsertMany returns empty array for empty input without hitting the database', async () => {
    const repository = new RunScoresRepository();

    // Empty input is a no-op; this should not require a live DB connection.
    const result = await repository.upsertMany({ data: [] });

    expect(result).toEqual([]);
  });
});
