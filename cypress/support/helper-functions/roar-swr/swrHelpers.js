import { languageOptions } from './languageOptions';

export const playSWR = ({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  optional = false,
  auth = 'username',
} = {}) => {
  // Log in once at the beginning of the test case that calls playSWR
  if (auth === 'username') {
    cy.login(Cypress.env('PARTICIPANT_USERNAME'), Cypress.env('PARTICIPANT_PASSWORD'));
    cy.visit('/');
  }
  if (auth === 'clever') {
    cy.visit('/');
    cy.loginWithClever(Cypress.env('cleverSchoolName'), Cypress.env('CLEVER_USERNAME'), Cypress.env('CLEVER_PASSWORD'));
  }

  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  cy.get('.p-tabview').contains(languageOptions[language].gameTab).should('exist');
  cy.visit(languageOptions[language].url);

  cy.get('.jspsych-btn').should('be.visible').click();

  cy.wait(0.1 * Cypress.env('timeout'));
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  playSWRGame(administration, language, optional);
};

function playSWRGame(administration, language, optional = false) {
  // play tutorial
  cy.contains(languageOptions[language].introText);
  for (let i = 0; i < 3; i++) {
    cy.get('body').type('{leftarrow}');
  }
  cy.get('.jspsych-btn').should('be.visible').click();
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
  cy.wait(0.2 * Cypress.env('timeout'));
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }
  cy.get('.p-tabview').contains(languageOptions[language].gameTab).should('exist');
}

function playIntro(language) {
  for (let i = 0; i <= 5; i++) {
    cy.log(i);
    cy.wait(0.2 * Cypress.env('timeout'));
    cy.get('body').type('{leftarrow}{rightarrow}');
    cy.wait(0.2 * Cypress.env('timeout'));
    cy.get('body').type('{leftarrow}{rightarrow}');
    cy.wait(0.2 * Cypress.env('timeout'));
  }
  cy.get('.jspsych-btn').contains(languageOptions[language].continue).click();
  Cypress.on('uncaught:exception', () => {
    return false;
  });
}

function playSWRBlock(language, block_termination_phrase) {
  cy.wait(0.3 * Cypress.env('timeout'));
  cy.get('body').then((body) => {
    cy.log('entering stage: ', block_termination_phrase);
    if (!body.find('.stimulus').length > 0) {
      cy.get('body').type('{leftarrow}');
      cy.get('.jspsych-btn').contains(languageOptions[language].continue).click();
      Cypress.on('uncaught:exception', () => {
        return false;
      });
    } else {
      cy.get('body').type('{rightarrow}');
      cy.get('body').type('{leftarrow}');
      playSWRBlock(language, block_termination_phrase);
    }
  });
}

function finishSWR(block_termination_phrase) {
  cy.wait(0.3 * Cypress.env('timeout'));
  cy.get('body').then((body) => {
    if (!body.find('.stimulus').length > 0) {
      assert(cy.contains(block_termination_phrase));
      cy.wait(0.2 * Cypress.env('timeout'));
      cy.get('body').type('{leftarrow}');
    } else {
      // cy.get(".stimulus").should("be.visible");
      cy.wait(0.2 * Cypress.env('timeout'));
      cy.get('body').type('{rightarrow}');
      finishSWR(block_termination_phrase);
    }
  });
}
