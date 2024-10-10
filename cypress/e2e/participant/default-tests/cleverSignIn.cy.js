import { signInWithClever } from '../../../support/helper-functions/participant/participant-helpers';

describe('Cypress test to login in Clever', () => {
  it('passes', () => {
    cy.visit('/');
    signInWithClever();
  });
});
