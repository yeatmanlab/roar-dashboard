import { describe, it, expect } from 'vitest';
import { AgreementRepository } from './agreement.repository';

/**
 * AgreementRepository unit tests.
 *
 * Verifies that the repository is instantiable and exposes the expected interface.
 * Actual query behaviour is covered by agreement.repository.integration.test.ts.
 */
describe('AgreementRepository', () => {
  it('should be instantiable', () => {
    const repository = new AgreementRepository();

    expect(repository).toBeDefined();
    expect(repository).toBeInstanceOf(AgreementRepository);
  });

  it('should have standard repository methods', () => {
    const repository = new AgreementRepository();

    expect(typeof repository.create).toBe('function');
    expect(typeof repository.getById).toBe('function');
    expect(typeof repository.update).toBe('function');
    expect(typeof repository.delete).toBe('function');
  });

  it('should have transaction support', () => {
    const repository = new AgreementRepository();

    expect(typeof repository.runTransaction).toBe('function');
  });

  it('should have listAll method', () => {
    const repository = new AgreementRepository();

    expect(typeof repository.listAll).toBe('function');
  });

  it('should have getVersionsByAgreementIds method', () => {
    const repository = new AgreementRepository();

    expect(typeof repository.getVersionsByAgreementIds).toBe('function');
  });
});
