describe("Testing playthrough of SWR as a participant", () => {
    it("ROAR-Word", () => {
        let test_login = "testingUser4";
        let test_pw = "password4";

        cy.login(test_login, test_pw);
        cy.visit("/");

        cy.get(".p-dropdown-trigger", { timeout: 10000 })
            .should("be.visible")
            .click();
        cy.get(".p-dropdown-item", { timeout: 10000 })
            .contains("ZZZ Test Cypress Play Keypress Games")
            .should("be.visible")
            .click();

        cy.get(".p-tabview").contains("ROAR-Word");
        cy.visit(`/game/swr`);

        cy.get(".jspsych-btn", { timeout: 60000 }).should("be.visible").click();

        // handles error where full screen throws a permissions error
        cy.wait(500);
        Cypress.on("uncaught:exception", () => {
            return false;
        });

        playSWRGame();
    });
});

function playSWRGame() {
    // play tutorial
    cy.contains("Welcome to the Single Word Recognition activity");
    cy.wait(500);
    for (let i = 0; i < 3; i++) {
        cy.get("body").type("{leftarrow}");
        cy.wait(500);
    }
    cy.get(".jspsych-btn", { timeout: 10000 }).should("be.visible").click();
    Cypress.on("uncaught:exception", () => {
        return false;
    });

    // intro
    playIntro();

    playSWRBlock("You are halfway through the first block");
    playSWRBlock("You have completed the first block");
    playSWRBlock("You are halfway through the second block");
    playSWRBlock("You have completed the second block");
    playSWRBlock("You are halfway through the third block");
    finishSWR("Congratulations");

    // check if game completed
    cy.visit("/");
    cy.get(".p-dropdown-trigger", { timeout: 20000 })
        .should("be.visible")
        .click();
    cy.get(".p-dropdown-item", { timeout: 10000 })
        .contains("ZZZ Test Cypress Play Keypress Games")
        .should("be.visible")
        .click();
    cy.get(".tabview-nav-link-label")
        .contains("ROAR-Word")
        .should("have.attr", "data-game-status", "complete");
}

function playIntro() {
    for (let i = 0; i < 5; i++) {
        cy.wait(5500);
        cy.get("body").type("{leftarrow}{rightarrow}");
        cy.wait(1000);
        cy.get("body").type("{leftarrow}{rightarrow}");
    }
    cy.get(".jspsych-btn").contains("Continue").click();
    Cypress.on("uncaught:exception", () => {
        return false;
    });
}

function playSWRBlock(block_termination_phrase) {
    cy.get("body").then((body) => {
        cy.wait(5500);
        cy.log("entering stage: ", block_termination_phrase);
        if (!body.find(".stimulus").length > 0) {
            cy.wait(400);
            cy.get("body").type("{leftarrow}");
            cy.get(".jspsych-btn").contains("Continue").click();
            Cypress.on("uncaught:exception", () => {
                return false;
            });
        } else {
            cy.get("body").type("{rightarrow}");
            cy.wait(400);
            cy.get("body").type("{leftarrow}");
            playSWRBlock(block_termination_phrase);
        }
    });
}

function finishSWR(block_termination_phrase) {
    cy.get("body").then((body) => {
        cy.wait(4000);
        if (!body.find(".stimulus").length > 0) {
            cy.wait(400);
            assert(cy.contains(block_termination_phrase));
            cy.get("body").type("{leftarrow}");
            cy.wait(400);
        } else {
            // cy.get(".stimulus").should("be.visible");
            cy.get("body").type("{rightarrow}");
            finishSWR(block_termination_phrase);
        }
    });
}
