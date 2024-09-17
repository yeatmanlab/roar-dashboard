import { signInAsSuperAdmin } from '../../../support/helper-functions/super-admin/superAdminHelpers';
import { getDevFirebase } from '../../../support/devFirebase';
import { deleteTestAdministrators } from '../../../support/query.js';

const adminFirestore = getDevFirebase('admin').db;
const adminAuth = getDevFirebase('admin').auth;

const assessmentFirestore = getDevFirebase('assessment').db;
const assessmentAuth = getDevFirebase('assessment').auth;

describe('Delete Test Administrations', () => {
  before(() => {
    signInAsSuperAdmin(adminAuth);
    signInAsSuperAdmin(assessmentAuth);
  });

  it('should delete all test administrations for super and partner administrators', () => {
    deleteTestAdministrators(adminFirestore, assessmentFirestore);
  });
});
