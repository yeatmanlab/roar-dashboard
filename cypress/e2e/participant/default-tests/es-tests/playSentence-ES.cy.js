import { playSRE } from '../../../../support/helper-functions/roar-sre/sreHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const administration = Cypress.env('testSpanishRoarAppsAdministration');
const language = 'es';

const app = '@bdelab/roar-sre';

describe('ROAR - Sentence Play Through', () => {
  it('Plays SRE', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playSRE({
          administration: administration,
          language: language,
        });
      }
    });
  });
});
