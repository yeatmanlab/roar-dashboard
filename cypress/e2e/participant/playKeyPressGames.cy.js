import { keypressGames} from "./keyPressGamesList";

describe("Cypress tests to play SWR and SRE as a participant", () => {
    keypressGames.forEach((game) => {
        it(game.name, () => {
            let test_login = "testingUser4";
            let test_pw = "password4";

            cy.login(test_login, test_pw);

            cy.get(".p-dropdown-trigger", { timeout: 10000 })
                .should("be.visible")
                .click();
            cy.get(".p-dropdown-item", { timeout: 10000 })
                .contains("ZZZ Test Cypress Play Keypress Games")
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

            if (game.startBtn2) {
                cy.wait(500)

                cy.get('b').contains("I agree").click()
                cy.get(game.startBtn2, { timeout: 10000 })
                    .should("be.visible")
                    .click();
                cy.get(game.startBtn2, { timeout: 10000 })
                    .should("be.visible")
                    .click();
            }

            // handles error where full screen throws a permissions error
            cy.wait(500);
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

            // // clicks through first introduction pages
            // for (let i = 0; i < game.introIters; i++) {
            //     cy.get(game.introBtn, { timeout: 10000 })
            //         .should("be.visible")
            //         .click();
            //     // cy.wait(400);
            // }

            playROARKeypressGame(game);
        });
    });
});

function playROARKeypressGame(game) {
    cy.clock()
    for (let i = 0; i < game.numIter; i++) {
        cy.get("body").type("{leftarrow}{rightarrow}")
        // advance by 5s each loop (3 min == 180s/5 = 36)
        cy.tick(5000)
    }
}

function chooseCorrectKeypress(game, overflow) {
    cy.get("body").then((body) => {
        if (body.find(game.introBtn).length > 0) {
            body.find(game.introBtn).click();
        } else {
            body.find(game.clickableItem).first().click();
            if (overflow < 50) {
                chooseStimulusOrContinue(game, overflow++);
            }
        }
    });
}
