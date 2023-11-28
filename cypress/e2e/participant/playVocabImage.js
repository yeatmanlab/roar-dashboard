describe("Cypress test to login and play picture vocab as participant", () => {
    it("passes", () => {
        let test_login = "testingUser4";
        let test_pw = "password4";
        // how can we write some logic to reset the already played

        cy.login(test_login, test_pw);

        cy.wait(1000);

        cy.get(".roar-tabview-game").click();

        cy.wait(8000);
        cy.contains("GO").click();
        // handles error where full screen throws a permissions error
        Cypress.once("uncaught:exception", () => {
            return false;
        });

        // picks first alien: woopee!
        cy.get(".intro_aliens").first().click();

        cy.get(".continue").click();
        cy.wait(1000);
        cy.get(".continue").click();
        cy.wait(1000);
        cy.get(".continue").click();
        cy.wait(1000);

        playROARVocab();

        // intro game mode
    });
});

function playROARVocab() {
    continueClickingVocabImg();
    continueClickingVocabImg();
    continueClickingVocabImg();
    continueClickingVocabImg();
    continueClickingVocabImg();
}

function continueClickingVocabImg() {
    cy.get("body").then((body) => {
        if (!body.find(".continue").length > 0) {
            body.find(".vocab_img").click();
            cy.wait(50);
            continueClickingVocabImg();
        } else {
            body.find(".continue").click();
        }
    });
}
