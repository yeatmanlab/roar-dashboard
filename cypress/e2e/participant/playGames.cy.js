import { games } from "./gamesList.js";

describe("Cypress tests to play games as a participant", () => {
    games.forEach((game) => {
        it(game.name, () => {
            // this is a user that has an assignment of roarVocab -- how can we create a user that can
            // ALWAYS play the game
            let test_login = "testingUser4";
            let test_pw = "password4";
            // how can we write some logic to reset the already played

            cy.login(test_login, test_pw);

            cy.wait(1000);

            cy.get(".p-dropdown-label").click();
            cy.get(".p-dropdown-item").contains("numTrialsTotal").click();

            cy.get(".p-tabview").contains(game.name).click();
            cy.get(".pointer").filter(":visible").click();
            cy.url().should('include', `/game/${game.id}`) // => true
            // assert(url.includes(game.id))
            // cy.contains("GO")

            // cy.wait(8000);
            // cy.contains("GO").click();

            // // handles error where full screen throws a permissions error
            // Cypress.once("uncaught:exception", () => {
            //     return false;
            // });

            // // if the game prompts some setup, make the choice
            // if (game.setUpChoice.length > 0) {
            //     cy.get(game.setUpChoice).first().click();
            // }

            // // clicks through first introduction pages
            // cy.get(".continue").click();
            // cy.wait(1000);
            // cy.get(".continue").click();
            // cy.wait(1000);
            // cy.get(".continue").click();
            // cy.wait(1000);

            // playROARGame(game.clickableItem, game.correctAnswer, game.numIter);

            // //     // intro game mode
        });
    });
});

function playROARGame(clickableItem, correctAnswer, numIter) {
    for (let i = 0; i < numIter; i++) {
        continueClickingVocabImg(clickableItem, correctAnswer);
    }
}

function continueClickingVocabImg(clickableItem, correctAnswer) {
    cy.get("body").then((body) => {
        if (!body.find(".continue").length > 0) {
            body.find(clickableItem).click();
            cy.wait(50);
            continueClickingVocabImg(clickableItem, correctAnswer);
        } else {
            body.find(".continue").click();
        }
    });
}
