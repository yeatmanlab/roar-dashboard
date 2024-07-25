import { testSpecs } from '../../../fixtures/taskTestSpecs.js';
const timeout = Cypress.env('timeout');

function checkOptionalGame(spec, admin, text) {
  cy.get('body').then(($body) => {
    if ($body.find('[data-cy="switch-show-optional-assessments"]').length > 0) {
      cy.switchToOptionalAssessments();
      if (text.includes(spec.name)) {
        cy.log(`Initializing test for optional game: ${spec.name}`);

        spec.spec({
          administration: admin,
          language: spec.language,
        });
      } else {
        cy.log('No optional game found for game:', spec.name);
      }
    } else {
      cy.log('No game found for game:', spec.name);
    }
  });
}

function testGame(spec, admin) {
  cy.wait(0.1 * timeout);
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
        checkOptionalGame(spec, admin, text);
      }
    });
}

describe('Testing synced administration: Synced Administration 9680685173', () => {
  it('Tests a synced administration', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/', { timeout: 2 * timeout });
    cy.selectAdministration('Synced Administration 9680685173');
    testSpecs.forEach((spec) => {
      testGame(spec, 'Synced Administration 9680685173');
    });
    cy.log(`Found administration: Synced Administration 9680685173`);
  });
});
