import { signInAsSuperAdmin } from '../../../support/helper-functions/super-admin/superAdminHelpers';
import { getDevFirebase } from '../../../support/devFirebase';
import { deleteTestAdmins } from '../../../support/query.js';

const adminAuth = getDevFirebase('admin').auth;
const adminFirestore = getDevFirebase('admin').db;

describe('Delete Test Administrations', () => {
  before(() => {
    signInAsSuperAdmin(adminAuth);
  });

  it('should delete all test administrations for super and partner administrators', () => {
    deleteTestAdmins(adminFirestore);
  });
});
