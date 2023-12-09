describe('Cypress test to login and play picture vocab as participant', () => {
  it('passes', () => {
    // this is a user that has an assignment of roarVocab -- how can we create a user that can
    // ALWAYS play the game
    // how can we write some logic to reset the already played

    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));

    cy.wait(1000);
    cy.get('button').contains('Sign Out').click();

    // successfully back at Login page
    cy.contains('Welcome to ROAR!');
  });
});
