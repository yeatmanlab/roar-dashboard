import {games } from "./gamesList"

describe("Cypress tests to play games as a participant", () => {
    games.forEach((game) => {
        it(game.name, () => {
            // this is a user that has an assignment of roarVocab -- how can we create a user that can
            // ALWAYS play the game
            let test_login = "testingUser4";
            let test_pw = "password4";
            // how can we write some logic to reset the already played

            cy.login(test_login, test_pw);

            cy.get(".p-dropdown-trigger", { timeout: 10000 })
                .should("be.visible")
                .click();
            cy.get(".p-dropdown-item", { timeout: 10000 })
                .contains("Vocab numTrialsTotal 3")
                .should("be.visible")
                .click();
            // cy.get(".p-dropdown-item").contains("numTrialsTotal").click();
            // cy.get('.p-dropdown-item', {timeout: 10000}).should('be.visible').click();

            cy.get(".p-tabview").contains(game.name);
            cy.visit(`/game/${game.id}`);

            // cy.contains("Preparing your game")

            cy.get(".jspsych-btn", { timeout: 60000 })
                .should("be.visible")
                .click();

            // handles error where full screen throws a permissions error
            cy.wait(1000);
            Cypress.on("uncaught:exception", () => {
                return false;
            });

            // if the game prompts some setup, make the choice
            if (game.setUpChoice) {
                cy.get(game.setUpChoice, { timeout: 10000 })
                    .should("be.visible")
                    .first()
                    .click();
            }

            // clicks through first introduction pages
            for (let i = 0; i < game.introIters; i++) {
                cy.get(game.introBtn).click();
                cy.wait(1000);
            }

            playROARGame(game)

        });
    });
});

function playROARGame(game) {
    for (let i = 0; i < game.numIter; i++) {
        chooseStimulusOrContinue(game)
    }
}

function chooseStimulusOrContinue(game) {
    cy.get("body").then((body) => {
        if (body.find(game.introBtn).length > 0) {
            body.find(game.introBtn).click();
        } else {
            body.find(game.clickableItem).first().click();
            cy.wait(400);
            chooseStimulusOrContinue(game);
        }
    });
}
