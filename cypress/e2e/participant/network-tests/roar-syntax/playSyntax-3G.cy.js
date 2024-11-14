import { playSyntax } from '../../../../support/helper-functions/roar-syntax/syntaxHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = 'core-tasks';
const administration = 'Cypress Test Roar Syntax';

describe('ROAR - Syntax Play Through', () => {
  it('Plays the Roar Syntax/Core Tasks Game with a simulated 3g connection', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playSyntax({ administration: administration, auth: 'username' });
      }
    });
  });
});
