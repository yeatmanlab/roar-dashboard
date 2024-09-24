import { deleteTestOrgs } from '../../../support/query.js';
import { useDevFirebase, signInAsSuperAdmin } from '../../../support/utils.js';

const { auth: adminAuth, db: adminDb } = useDevFirebase('adminDev');

describe('Remove Test Organizations from Firestore.', () => {
  before(() => {
    signInAsSuperAdmin(adminAuth);
  });

  it('should delete all test administrations for super and partner administrators', () => {
    cy.wrap(deleteTestOrgs(adminDb), { timeout: 6 * Cypress.env('timeout') });
  });
});
