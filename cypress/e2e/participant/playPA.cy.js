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

describe("Cypress tests to play Phonological Awareness game as a participant", () => {
    it(pa.name, () => {
        let test_login = "testingUser4";
        let test_pw = "password4";

        cy.login(test_login, test_pw);
        cy.visit("/");

        cy.get(".p-dropdown-trigger", { timeout: 10000 }).click();
        cy.get(".p-dropdown-item", { timeout: 10000 })
            .contains("ZZZ Test Play PA")
            .click();

        // cy.get(".p-tabview").contains(pa.name);
        cy.visit(`/game/${pa.id}`);

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
    // play intro
    playFirstTutorial();
    playTrial(6, "Awesome! You have completed the first block.");
    playSecondTutorial();
    playTrial(6, "Awesome! You have completed the second block.");
    playThirdTutorial();
    playTrial(6, "Awesome! You have completed the last block.");
}

function playTrial(numTimes, trialFinishPhrase) {
    // for (let i = 0; i < 6; i++) {
    if (numTimes > 0) {
        cy.wait(8500);
        cy.get(".testImageDown", {
            timeout: 4000,
        })
            .first()
            .click();
        cy.log("iteration: ", numTimes);
        playTrial(numTimes - 1);
    } else {
        cy.wait(6000);
        assert(cy.contains(trialFinishPhrase))
        cy.get(".continue", { timeout: 14000 }).click();
    }
}

function playFirstTutorial() {
    // mouse -> map (index 2)
    cy.wait(16000);
    cy.get('img[src*="map.webp"]') // get the containing toolbar
        .click();
    cy.wait(16000);
    cy.get('img[src*="rope.webp"]') // get the containing toolbar
        .click();
    cy.wait(3000);
    cy.get(".continue").click();
}

function playSecondTutorial() {
    cy.wait(16000);
    cy.get('img[src*="nut.webp"]') // get the containing toolbar
        .click();
    cy.wait(16000);
    cy.get('img[src*="wash.webp"]') // get the containing toolbar
        .click();
    cy.wait(3000);
    cy.get(".continue").click();
}

function playThirdTutorial() {
    cy.wait(12000);
    cy.get('img[src*="/ball.webp"]') // get the containing toolbar
        .click();
    cy.wait(12000);
    cy.get('img[src*="/rain.webp"]') // get the containing toolbar
        .click();
    cy.wait(4000);
    cy.get(".continue").click();
}

