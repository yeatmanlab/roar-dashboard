import { deleteTestAdministrations } from '../../../support/query.js';
import { useDevFirebase, signInAsSuperAdmin } from '../../../support/utils.js';

const { auth, db } = useDevFirebase('adminDev');

describe('Delete Test Administrations', () => {
  before(() => {
    signInAsSuperAdmin(auth);
  });

  it('should delete all test administrations for super and partner administrators', () => {
    cy.wrap(deleteTestAdministrations(db), { timeout: 6 * Cypress.env('timeout') });
  });
});
