import { games } from "./buttonGamesList";

describe("Cypress tests to play vocab, cva, letter, and multichoice games as a participant", () => {
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
                .contains("ZZZ Test Cypress Playthrough Button Games")
                .should("be.visible")
                .click();
            // cy.get(".p-dropdown-item").contains("numTrialsTotal").click();
            // cy.get('.p-dropdown-item', {timeout: 10000}).should('be.visible').click();

            cy.get(".p-tabview").contains(game.name);
            cy.visit(`/game/${game.id}`);

            // cy.contains("Preparing your game")

            cy.get(game.startBtn, { timeout: 60000 })
                .should("be.visible")
                .click();

            // case for game/pa -- it has two initiation buttons that need to be clicked
            if (game.startBtn2) {
                cy.get(game.startBtn2, { timeout: 60000 })
                    .should("be.visible")
                    .click();
            }

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
                cy.get(game.introBtn, { timeout: 10000 })
                    .should("be.visible")
                    .click();
                // cy.wait(400);
            }

            playROARGame(game);
        });
    });
});

function playROARGame(game) {
    let overflow = 0;
    for (let i = 0; i < game.numIter; i++) {
        chooseStimulusOrContinue(game, overflow);
    }
}

function chooseStimulusOrContinue(game, overflow) {
    cy.get("body").then((body) => {
        if (body.find(game.introBtn).length > 0) {
            body.find(game.introBtn).click();
        } else {
            body.find(game.clickableItem).first().click();
            cy.wait(100);
            if (overflow < 50) {
                chooseStimulusOrContinue(game, overflow++);
            }
        }
    });
}
