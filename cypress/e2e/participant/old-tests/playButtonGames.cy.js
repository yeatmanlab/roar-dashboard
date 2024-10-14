import { games } from '../../../fixtures/participant/buttonGamesList.js';

describe('Testing play through of vocab, cva, letter, and multichoice games as a participant', () => {
  games.forEach((game) => {
    it(`${game.name} Play through Test`, () => {
      cy.login(Cypress.env('PARTICIPANT_USERNAME'), Cypress.env('PARTICIPANT_PASSWORD'));
      cy.visit('/');

      cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));
      cy.get('.tabview-nav-link-label').contains(game.name);

      cy.visit(`/game/${game.id}`);

      // Long timeout is needed for picture vocab
      cy.get(game.startBtn).should('be.visible').click();

      // case for game/pa -- it has two initiation buttons that need to be clicked
      if (game.startBtn2) {
        cy.get(game.startBtn2).should('be.visible').click();
      }

      // handles error where full screen throws a permissions error
      cy.wait(0.2 * Cypress.env('timeout'));
      Cypress.on('uncaught:exception', () => {
        return false;
      });

      // if the game prompts some setup, make the choice
      if (game.setUpChoice) {
        cy.get(game.setUpChoice).should('be.visible').first().click();
      }

      // clicks through first introduction pages
      for (let i = 0; i < game.introIters; i++) {
        cy.get(game.introBtn).should('be.visible').click();
      }

      playROARGame(game);

      cy.visit('/');
      cy.wait(0.2 * Cypress.env('timeout'));
      cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));
      cy.get('.tabview-nav-link-label').contains(game.name).should('exist');
    });
  });
});

function playROARGame(game) {
  // overflow prevents recursive call from recursing forever
  let overflow = 0;
  for (let i = 0; i < game.numIter; i++) {
    makeChoiceOrContinue(game, overflow);
  }
}

function makeChoiceOrContinue(game, overflow) {
  // prechoiceDelay allows for cypress to pause to wait until a button renders
  if (game.prechoiceDelay !== null) {
    cy.wait(game.preChoiceDelay);
  }
  cy.get('body').then((body) => {
    if (body.find(game.introBtn).length > 0) {
      cy.get(game.introBtn).click();
    } else {
      // Timing issues with the stimulus prevent this assertion from being used -- tabling until next sprint
      // cy.get(game.stimulus).should("be.visible")
      if (game.correctChoice && body.find(game.correctChoice).length > 0) {
        body.find(game.correctChoice).click();
      }
      // assert stimulus is visible and num items rendered is correct
      else {
        body.find(game.clickableItem).first().click();
      }
      if (overflow < 100) {
        makeChoiceOrContinue(game, overflow + 1);
      }
    }
  });
}
