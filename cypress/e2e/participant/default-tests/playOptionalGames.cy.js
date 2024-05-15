import { optionalGames } from '../../../fixtures/optionalGamesList';
import { isCurrentVersion } from '../../../support/utils';

const administration = Cypress.env('testOptionalRoarAppsAdministration');
const language = 'en';

function playOptionalGame(game, administration, language, optional) {
  game.testSpec(administration, language, optional);
}

describe('Play Optional Games', () => {
  optionalGames.forEach((game) => {
    it(`Plays ${game.name}`, () => {
      cy.wrap(isCurrentVersion(game.app)).then((isCurrentVersion) => {
        if (isCurrentVersion) {
          cy.log(`Did not detect a new version of ${game.app}, skipping test.`);
        } else {
          cy.log(`Detected a new version of ${game.app}, running test.`);
          playOptionalGame(game, administration, language, game.optional);
        }
      });
    });
  });
});
