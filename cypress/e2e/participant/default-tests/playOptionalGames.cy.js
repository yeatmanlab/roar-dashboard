import { optionalGames } from '../../../fixtures/optionalGamesList';

const administration = Cypress.env('testOptionalRoarAppsAdministration');

function playOptionalGame(game, administration, optional) {
  game.testSpec(administration, optional);
}

describe('Play Optional Games', () => {
  optionalGames.forEach((game) => {
    it(`Plays ${game.name}`, () => {
      playOptionalGame(game, administration, true);
    });
  });
});
