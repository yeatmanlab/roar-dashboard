import { getOpenAdministrations } from '../../support/helper-functions/query';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

describe('Get Open Administrations', () => {
  before(() => {
    const auth = getAuth();
    cy.then(() =>
      signInWithEmailAndPassword(auth, 'testsuperadmin1@roar-auth.com', Cypress.env('superAdminPassword')),
    ).then((userCredential) => {
      cy.log('User: ', userCredential.user);
    });
  });

  it('should return open administrations', () => {
    cy.then(() => getOpenAdministrations()).then((admins) => {
      cy.log(admins.length);
      cy.log(admins);
      admins.forEach((admin) => {
        cy.log(admin);
      });
    });
  });
});
