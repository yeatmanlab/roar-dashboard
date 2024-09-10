import { signInWithClever } from '../../../support/helper-functions/participant/participant-helpers';

export const timeout = Cypress.env('timeout');

describe('Cypress test to login in Clever', () => {
  it('passes', () => {
    cy.visit('/');
    signInWithClever();
  });
});
