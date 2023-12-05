let pa = {
    name: "ROAR-Phoneme",
    id: "pa",
    startBtn: ".instructionCanvasNS",
    startBtn2: ".jspsych-btn",
    setUpChoice: "",
    introIters: 2,
    preAnswerDelay: 6000,
    introBtn: ".continue",
    clickableItem: ".jspsych-audio-button-response-button",
    correctChoice: "",
    numIter: 2,
};

describe("Cypress tests to play pa game as a participant", () => {
    it(pa.name, () => {
        // this is a user that has an assignment of roarVocab -- how can we create a user that can
        // ALWAYS play the game
        let test_login = "testingUser4";
        let test_pw = "password4";
        // how can we write some logic to reset the already played

        cy.login(test_login, test_pw);

        cy.get(".p-dropdown-trigger", { timeout: 10000 })
            .click();
        cy.get(".p-dropdown-item", { timeout: 10000 })
            .contains("ZZZ Test Cypress Playthrough Button Games")
            .click();

        // cy.get(".p-tabview").contains(pa.name);
        cy.visit(`/game/${pa.id}`);

        // cy.contains("Preparing your game")

        cy.get(pa.startBtn, { timeout: 60000 }).should("be.visible").click();

        // case for game/pa -- it has two initiation buttons that need to be clicked
        if (pa.startBtn2) {
            cy.get(pa.startBtn2, { timeout: 60000 })
                .should("be.visible")
                .click();
        }

        // handles error where full screen throws a permissions error
        cy.wait(1000);
        Cypress.on("uncaught:exception", () => {
            return false;
        });

        // if the game prompts some setup, make the choice
        if (pa.setUpChoice) {
            cy.get(pa.setUpChoice, { timeout: 10000 })
                .should("be.visible")
                .first()
                .click();
        }

        // clicks through first introduction pages
        for (let i = 0; i < pa.introIters; i++) {
            cy.get(pa.introBtn, { timeout: 10000 })
                .should("be.visible")
                .click();
            // cy.wait(400);
        }

        playPA(pa);
    });
});

function playPA(game) {
    let overflow = 0;
    // play intro
    playFirstTutorial();
    chooseStimulusOrContinue(game, overflow);
    chooseStimulusOrContinue(game, overflow);
    playSecondTutorial();
    chooseStimulusOrContinue(game, overflow);
    chooseStimulusOrContinue(game, overflow);
    playThirdTutorial();
    chooseStimulusOrContinue(game, overflow);
}

function playFirstTutorial() {
    // mouse -> map (index 2)
    cy.wait(18000);
    cy.get('img[src*="map.webp"]') // get the containing toolbar
        .click();
    cy.wait(18000);
    cy.get('img[src*="rope.webp"]') // get the containing toolbar
        .click();
    cy.wait(4000);
    cy.get(".continue").click();
}

function playSecondTutorial() {
    cy.wait(18000);
    cy.get('img[src*="nut.webp"]') // get the containing toolbar
        .click();
    cy.wait(18000);
    cy.get('img[src*="wash.webp"]') // get the containing toolbar
        .click();
    cy.wait(4000);
    cy.get(".continue").click();
}

function playThirdTutorial() {
    cy.wait(18000);
    cy.get('img[src*="ball.webp"]') // get the containing toolbar
        .click();
    cy.wait(18000);
    cy.get('img[src*="rain.webp"]') // get the containing toolbar
        .click();
    cy.wait(4000);
    cy.get(".continue").click();
}

function chooseStimulusOrContinue(game, overflow) {
    cy.get("body").then((body) => {
        cy.wait(10000);
        if (body.find(".continue").length > 0) {
            body.find(".continue").click();
        } else if (body.find("#jspsych-loading-progress-bar-container").length > 0) {
            cy.wait(15000);
        } else {
            cy.get(".jspsych-audio-button-response-button", { timeout: 10000 })
                .should("be.visible", "")
                .first()
                .click();
            if (overflow < 50) {
                chooseStimulusOrContinue(game, overflow++);
            }
        }
    });
}
