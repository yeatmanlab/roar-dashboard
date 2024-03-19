import { languageOptions } from './languageOptions';

const timeout = Cypress.env('timeout');

export const playSWR = (administration, language, optional = false) => {
  // Log in once at the beginning of the test case that calls playSWR
  cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));

  cy.visit('/', { timeout: 2 * timeout });
  cy.selectAdministration(administration);

  if (optional) {
    cy.switchToOptionalAssessments();
  }

  cy.get('.p-tabview', { timeout: timeout }).contains(languageOptions[language].gameTab).should('exist');
  cy.visit(languageOptions[language].url);

  cy.get('.jspsych-btn', { timeout: 3 * timeout })
    .should('be.visible')
    .click();

  cy.wait(0.1 * timeout);
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  playSWRGame(administration, language, optional);
};

function playSWRGame(administration, language, optional = false) {
  // play tutorial
  cy.contains(languageOptions[language].introText, { timeout: timeout });
  for (let i = 0; i < 3; i++) {
    cy.get('body', { timeout: timeout }).type('{leftarrow}');
  }
  cy.get('.jspsych-btn', { timeout: 10 * timeout })
    .should('be.visible')
    .click();
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  // intro
  playIntro(language);

  playSWRBlock(language, languageOptions[language].blockTerminationPhraseOne);
  playSWRBlock(language, languageOptions[language].blockTerminationPhraseTwo);
  playSWRBlock(language, languageOptions[language].blockTerminationPhraseThree);
  playSWRBlock(language, languageOptions[language].blockTerminationPhraseFour);
  playSWRBlock(language, languageOptions[language].blockTerminationPhraseFive);
  finishSWR(languageOptions[language].blockTerminationPhraseSix);

  // check if game completed
  cy.visit('/');
  cy.wait(0.2 * timeout);
  cy.selectAdministration(administration);

  if (optional) {
    cy.switchToOptionalAssessments();
  }

  cy.get('.p-tabview', { timeout: timeout }).contains(languageOptions[language].gameTab).should('exist');
}

function playIntro(language) {
  for (let i = 0; i <= 5; i++) {
    cy.log(i);
    cy.wait(0.2 * timeout);
    cy.get('body').type('{leftarrow}{rightarrow}', { timeout: 5 * timeout });
    cy.wait(0.2 * timeout);
    cy.get('body').type('{leftarrow}{rightarrow}', { timeout: 2 * timeout });
    cy.wait(0.2 * timeout);
  }
  cy.get('.jspsych-btn', { timeout: 5 * timeout })
    .contains(languageOptions[language].continue)
    .click();
  Cypress.on('uncaught:exception', () => {
    return false;
  });
}

function playSWRBlock(language, block_termination_phrase) {
  cy.wait(0.3 * timeout);
  cy.get('body', { timeout: 5 * timeout }).then((body) => {
    cy.log('entering stage: ', block_termination_phrase);
    if (!body.find('.stimulus').length > 0) {
      cy.get('body', { timeout: timeout }).type('{leftarrow}');
      cy.get('.jspsych-btn', { timeout: 5 * timeout })
        .contains(languageOptions[language].continue, { timeout: 5 * timeout })
        .click();
      Cypress.on('uncaught:exception', () => {
        return false;
      });
    } else {
      cy.get('body', { timeout: timeout }).type('{rightarrow}');
      cy.get('body', { timeout: timeout }).type('{leftarrow}');
      playSWRBlock(language, block_termination_phrase);
    }
  });
}

function finishSWR(block_termination_phrase) {
  cy.wait(0.3 * timeout);
  cy.get('body', { timeout: 5 * timeout }).then((body) => {
    if (!body.find('.stimulus').length > 0) {
      assert(cy.contains(block_termination_phrase));
      cy.wait(0.2 * timeout);
      cy.get('body', { timeout: 5 * timeout }).type('{leftarrow}');
    } else {
      // cy.get(".stimulus").should("be.visible");
      cy.wait(0.2 * timeout);
      cy.get('body', { timeout: 5 * timeout }).type('{rightarrow}');
      finishSWR(block_termination_phrase);
    }
  });
}
