describe("Cypress test to login and play Single Word Recognition as participant", () => {
    it("passes", () => {
        let test_login = "testingUser4";
        let test_pw = "password4";
        // how can we write some logic to reset the already played

        cy.login(test_login, test_pw);

        cy.wait(1000);

        cy.get(".p-dropdown-trigger", { timeout: 10000 })
            .should("be.visible")
            .click();
        cy.get(".p-dropdown-item", { timeout: 10000 })
            .contains("### tes short swr")
            .should("be.visible")
            .click();
        cy.visit("/game/swr");

        cy.get('.jspsych-btn', { timeout: 60000 })
            .should("be.visible")
            .click();
        // handles error where full screen throws a permissions error
        Cypress.once("uncaught:exception", () => {
            return false;
        });
        cy.get('.jspsych-btn', { timeout: 60000 })
            .should("be.visible")
            .click();

        for(let i = 0; i < 3; i++) {
            cy.get("body").type('{leftarrow}');
        }
        cy.get('.jspsych-btn', { timeout: 60000 })
            .should("be.visible")
            .click();

        Cypress.once("uncaught:exception", () => {
            return false;
        });
        for(let i = 0; i < 8; i++) {
            cy.get("body").type('{leftarrow}');
            cy.get("body").type('{rightarrow}');
        }

        // playROARSWR();

        // intro game mode
    });
});

function playROARSWR() {
    continueClickingVocabImg();
    continueClickingVocabImg();
    continueClickingVocabImg();
    continueClickingVocabImg();
    continueClickingVocabImg();
}

function continueClickingVocabImg() {
    cy.get("body").then((body) => {
        if (!body.find("left").length > 0) {
            cy.get('body').trigger('keydown', { keyCode: 24});
            cy.wait(500);
            cy.get('body').trigger('keyup', { keyCode: 24});
            continueClickingVocabImg();
        } else {
            body.find(".continue").click();
        }
    });
}