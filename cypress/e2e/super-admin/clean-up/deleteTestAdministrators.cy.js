import { deleteTestAdministrators } from '../../../support/query.js';
import { useDevFirebase, signInAsSuperAdmin } from '../../../support/utils.js';

const { auth: adminAuth, db: adminDb } = useDevFirebase('adminDev');
const { auth: assessmentAuth, db: assessmentDb } = useDevFirebase('assessmentDev');

describe('Delete Test Administrations', () => {
  before(() => {
    signInAsSuperAdmin(adminAuth);
    signInAsSuperAdmin(assessmentAuth);
  });

  it('should delete all test administrations for super and partner administrators', () => {
    cy.wrap(deleteTestAdministrators(adminDb, assessmentDb), { timeout: 6 * Cypress.env('timeout') });
  });
});
