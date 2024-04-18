import { signInAsSuperAdmin } from '../../../support/helper-functions/super-admin/superAdminHelpers';
import { deleteTestRuns } from '../../../support/query';
import { getDevFirebase } from '../../../support/devFirebase';

const testUsers = Cypress.env('testUserList');

const adminAuth = getDevFirebase('admin').auth;
const adminFirestore = getDevFirebase('admin').db;

const assessmentAuth = getDevFirebase('assessment').auth;
const assessmentFirestore = getDevFirebase('assessment').db;

describe('Delete Test Runs', () => {
  before(() => {
    signInAsSuperAdmin(adminAuth);
    signInAsSuperAdmin(assessmentAuth);
  });

  it('should delete all test runs for all test users', () => {
    for (const testUser of testUsers) {
      cy.log('Deleting test runs for user:', testUser);
      deleteTestRuns(testUser, adminFirestore, assessmentFirestore);
    }
  });
});
