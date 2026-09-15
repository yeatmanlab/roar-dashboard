import { describe, it, expect } from 'vitest';
import { RunTrialInteractionsRepository } from './run-trial-interactions.repository';

/**
 * RunTrialInteractionsRepository Tests
 *
 * Tests the data access layer for run trial interactions.
 * Verifies that the repository properly extends BaseRepository
 * and has access to standard CRUD operations.
 */
describe('RunTrialInteractionsRepository', () => {
  it('should be instantiable', () => {
    const repository = new RunTrialInteractionsRepository();

    expect(repository).toBeDefined();
    expect(repository).toBeInstanceOf(RunTrialInteractionsRepository);
  });

  it('should have standard repository methods', () => {
    const repository = new RunTrialInteractionsRepository();

    expect(typeof repository.create).toBe('function');
    expect(typeof repository.getById).toBe('function');
    expect(typeof repository.update).toBe('function');
    expect(typeof repository.delete).toBe('function');
  });

  it('should have transaction support', () => {
    const repository = new RunTrialInteractionsRepository();

    expect(typeof repository.runTransaction).toBe('function');
  });
});
