import { signInAsSuperAdmin } from '../../support/helper-functions/super-admin/superAdminHelpers';
import { getDevFirebase } from '../../support/helper-functions/devFirebase';
import { getOpenAdministrations } from '../../support/helper-functions/query';

const adminAuth = getDevFirebase('admin').auth;
const adminFirestore = getDevFirebase('admin').db;

describe('Get Open Administrations', () => {
  before(() => {
    signInAsSuperAdmin(adminAuth);
  });

  it('should return open administrations', () => {
    cy.then(() => getOpenAdministrations(adminFirestore)).then((admins) => {
      cy.log(admins.length);
      cy.log(admins);
      admins.forEach((admin) => {
        cy.log(admin);
      });
    });
  });
});
