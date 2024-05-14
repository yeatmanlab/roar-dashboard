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
      playOptionalGame(game, administration, language, true);
    });
  });
});
