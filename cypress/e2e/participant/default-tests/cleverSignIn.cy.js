describe('Cypress test to login in Clever', () => {
  it('passes', () => {
    cy.visit(
      'https://clever.com/oauth/authorize?response_type=code&redirect_uri=https%3A%2F%2Flocalhost%3A5173%2Fauth-clever&client_id=1150d0bd8a44909bfdab',
    );
    // cy.visit('c');
    cy.get('button', { timeout: 10000 }).contains('Clever').click();
  });
});

//   cy.log('Test is disabled until a student with email/password is created in admin dev database.');
// cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
// cy.visit('/');
//

// cy.get('button', { timeout: 10000 }).contains('Sign Out').click();
//2Flocalhost%3A5173%2Fauth-clever&client_id=1150d0bd8a44909bfdab
// // successfully back at Login page
// cy.contains('Welcome to ROAR!');
//
// // Login via email / password
// cy.loginWithEmail(Cypress.env('participantEmail'), Cypress.env('participantEmailPassword'));
// cy.visit('/');
//
// cy.get('button', { timeout: 10000 }).contains('Sign Out').click();
//
// // successfully back at Login page
// cy.contains('Welcome to ROAR!');
