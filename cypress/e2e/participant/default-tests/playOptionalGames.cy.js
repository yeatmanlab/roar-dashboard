import { optionalGames } from '../../../fixtures/participant/optionalGamesList.js';
import { isCurrentVersion } from '../../../support/utils';

const administration = Cypress.env('testOptionalRoarAppsAdministration');
const language = 'en';
const optional = true;

function playOptionalGame(game, administration, language, optional) {
  game.testSpec({ administration: administration, language: language, optional: optional });
}

describe('Play Optional Games', () => {
  optionalGames.forEach((game) => {
    it(`Plays ${game.name}`, () => {
      cy.wrap(isCurrentVersion(game.app)).then((isCurrentVersion) => {
        if (isCurrentVersion) {
          cy.log(`Did not detect a new version of ${game.app}, skipping test.`);
        } else {
          cy.log(`Detected a new version of ${game.app}, running test.`);
          playOptionalGame(game, administration, language, optional);
        }
      });
    });
  });
});
