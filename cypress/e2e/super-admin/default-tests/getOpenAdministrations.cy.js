import { getOpenAdministrations } from '../../../support/query';
import { useDevFirebase, signInAsSuperAdmin } from '../../../support/utils.js';

const { auth: adminAuth, db: adminDb } = useDevFirebase('adminDev');

describe('Get Open Administrations', () => {
  before(() => {
    signInAsSuperAdmin(adminAuth);
  });

  it('should return open administrations', () => {
    cy.then(() => getOpenAdministrations(adminDb)).then((admins) => {
      cy.log(admins.length);
      cy.log(admins);
    });
  });
});
