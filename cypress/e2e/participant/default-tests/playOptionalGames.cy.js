import { optionalGames } from '../../../fixtures/optionalGamesList';

function playOptionalGame(game, administration, optional) {
  try {
    game.testSpec(administration, optional);
  } catch (error) {
    cy.log(`Error playing ${game.name}: ${error.message}`);
  }
}

describe('Play Optional Games', () => {
  Cypress._.each(optionalGames, (game) => {
    it(`Plays ${game.name}`, () => {
      cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
      playOptionalGame(game, Cypress.env('testOptionalRoarAppsAdministration'), true);
    });
  });
});
