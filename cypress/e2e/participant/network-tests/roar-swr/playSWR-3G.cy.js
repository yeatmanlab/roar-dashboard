import { playSWR } from '../../../../support/helper-functions/roar-swr/swrHelpers.js';
import { isCurrentVersion } from '../../../../support/utils';

const administration = Cypress.env('testRoarAppsAdministration');
const language = 'en';
const app = '@bdelab/roar-swr';

describe('ROAR - Word Play Through in a simulated 2G network', () => {
  it('Plays Word', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playSWR({ administration: administration, language: language });
      }
    });
  });
});
