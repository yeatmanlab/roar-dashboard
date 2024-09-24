import { deleteTestOrgs } from '../../../support/query.js';
import { useDevFirebase, signInAsSuperAdmin } from '../../../support/utils.js';

const { auth: adminAuth, db: adminDb } = useDevFirebase('adminDev');

describe('Delete Test Administrations', () => {
  before(() => {
    signInAsSuperAdmin(adminAuth);
  });

  it('should delete all test administrations for super and partner administrators', () => {
    cy.wrap(deleteTestOrgs(adminDb), { timeout: 6 * Cypress.env('timeout') });
  });
});
