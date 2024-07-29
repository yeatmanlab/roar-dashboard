import { testSpecs } from '../../../fixtures/taskTestSpecs.js';
const timeout = Cypress.env('timeout');

function checkOptionalGame(spec, admin) {
  cy.get('body').then(($body) => {
    if ($body.find('[data-cy="switch-show-optional-assessments"]').length > 0) {
      cy.log('Optional assessments button found, switching to optional assessments');
      cy.switchToOptionalAssessments();
      cy.wait(0.1 * timeout);

      cy.get('.p-tabview')
        .invoke('text')
        .then((text) => {
          if (text.includes(spec.name)) {
            cy.log(`Initializing test for optional game: ${spec.name}`);
            cy.wait(0.1 * timeout);
            spec.spec({
              administration: admin,
              language: spec.language,
              optional: true,
            });
          } else {
            cy.log('No optional game found for game:', spec.name, 'switching back to assessments.');
            cy.wait(0.1 * timeout);
            cy.switchToOptionalAssessments();
          }
        });
    } else {
      cy.log('No optional assessments button found.');
      cy.wait(0.1 * timeout);
    }
  });
}

function testGame(spec, admin) {
  cy.wait(0.3 * timeout);
  cy.get('.p-tabview')
    .invoke('text')
    .then((text) => {
      if (text.includes(spec.name)) {
        cy.log(`Initializing test for game: ${spec.name}`);
        spec.spec({
          administration: admin,
          language: spec.language,
        });
      } else {
        cy.log('No game found for game:', spec.name, 'checking for optional assessments.');
        checkOptionalGame(spec, admin);
      }
    });
}

describe('Testing synced administration: Synced Administration 8926319370', () => {
  it('Tests a synced administration', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/', { timeout: 2 * timeout });
    cy.selectAdministration('Synced Administration 8926319370');
    testSpecs.forEach((spec) => {
      testGame(spec, 'Synced Administration 8926319370');
    });
    cy.log(`Found administration: Synced Administration 8926319370`);
  });
});
