export const generatedSpecTemplate = (adminName) => {
  return `
  import { testSpecs } from "../../../fixtures/super-admin/taskTestSpecs.js";
  const timeout = Cypress.env('timeout');
  
  function checkOptionalGame(spec, admin) {
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="switch-show-optional-assessments"]').length > 0) {
        cy.log('Optional assessments button found, switching to optional assessments');
        cy.switchToOptionalAssessments();
        cy.wait(0.1 * timeout);
        cy.get('.p-tablist-tab-list').invoke('text').then((text) => {
            if (text.includes(spec.name)) {
              cy.log(\`Initializing test for optional game: \${spec.name}\`);
              cy.wait(0.1 * Cypress.env('timeout'));
              spec.spec({
                administration: admin,
                language: spec.language,
                optional: true,
              });
            } else {
              cy.log('No optional game found for game:', spec.name, 'switching back to assessments.');
              cy.switchToRequiredAssessments();
            }
        })
      } else {
        cy.log('No optional assessments button found.');
      }
    });
  }

  function testGame(spec, admin) {
    cy.wait(0.1 * timeout);
    cy.get('.p-tablist-tab-list')
      .invoke('text')
      .then((text) => {
        if (text.includes(spec.name)) {
          cy.log(\`Initializing test for game: \${spec.name}\`);
          spec.spec({
            administration: admin,
            language: spec.language,
          });
        } else {
          cy.log('No game found for game:', spec.name, 'checking for optional assessments.');
          checkOptionalGame(spec, admin);
          cy.wait(0.1 * Cypress.env('timeout'));
        }
      });
  }

  describe('Testing synced administration: ${adminName}', () => {
    it('Tests a synced administration', () => {
      cy.login(Cypress.env('PARTICIPANT_USERNAME'), Cypress.env('PARTICIPANT_PASSWORD'));
      cy.visit('/');
      cy.selectAdministration('${adminName}');
      testSpecs.forEach((spec) => {
        cy.get('body').then(($body) => {
          if ($body.find('[data-cy="switch-show-optional-assessments"]').length > 0) {
            cy.switchToRequiredAssessments();
          }
        });
        testGame(spec, '${adminName}');
      });
      cy.log(\`Found administration: ${adminName}\`);
    });
  });
  `;
};
