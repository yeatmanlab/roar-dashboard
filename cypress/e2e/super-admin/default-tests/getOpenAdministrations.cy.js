import { getOpenAdministrations } from '../../../support/query';
import { useDevFirebase, signInAsSuperAdmin } from '../../../support/utils.js';

const { auth, db } = useDevFirebase('adminDev');

describe('Get Open Administrations', () => {
  before(() => {
    signInAsSuperAdmin(auth);
  });

  it('should return open administrations', () => {
    cy.then(() => getOpenAdministrations(db)).then((admins) => {
      cy.log(admins.length);
      cy.log(admins);
    });
  });
});
