import { deleteTestRuns } from '../../../support/query';
import { useDevFirebase, signInAsSuperAdmin } from '../../../support/utils.js';

const { auth: adminAuth, db: adminDb } = useDevFirebase('adminDev');
const { auth: assessmentAuth, db: assessmentDb } = useDevFirebase('assessmentDev');

const testUsers = Cypress.env('testUserList');

// This test is used to delete all test runs for all test users
// Leaving this out of CI for now, as it has caused issues in the past with run IDs not being deleted properly

describe('Delete Test Runs', () => {
  before(() => {
    signInAsSuperAdmin(adminAuth);
    signInAsSuperAdmin(assessmentAuth);
  });

  it('should delete all test runs for all test users', () => {
    cy.log('Passes for now.');
    // for (const testUser of testUsers) {
    //   cy.log('Deleting test runs for user:', testUser);
    //   deleteTestRuns(testUser, adminFirestore, assessmentFirestore);
    // }
  });
});
