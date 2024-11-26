import { languageOptions } from './languageOptions';

const CLEVER_SCHOOL_NAME = Cypress.env('CLEVER_SCHOOL_NAME');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

const participantId = '123456789';
const questionInput = '42';

function typeEnter() {
  cy.get('body').type('{enter}');
}

function waitTimeout() {
  cy.wait(0.1 * Cypress.env('timeout'));
}

function playARFIntro() {
  waitTimeout();

  //   Click textbox and enter random participantId
  cy.get('#input-0').type(`${participantId} {enter}`);
  waitTimeout();
  typeEnter();
  waitTimeout();

  //   Click enter
  cy.get('body').type('1 {enter}');
  waitTimeout();

  typeEnter();
  waitTimeout();

  //   Click backspace
  cy.get('body').type('{backspace}');
  waitTimeout();

  // Input example number, enter x1
  cy.get('#practice_number').type('10');
  waitTimeout();

  cy.get('#practice_number').type('{enter}');
  typeEnter();
  waitTimeout();

  //   Enter x2
  //cy.get("body").type("x2 {enter}");
  typeEnter();
  typeEnter();
  //waitTimeout();

  //   Type 4, enter x2
  cy.get('#question_input_key').type('4');
  waitTimeout();
  cy.get('#question_input_key').type('{enter}');
  typeEnter();
  waitTimeout();
  typeEnter();

  //   Type 2, enter x2
  cy.get('#question_input_key').type('2');
  waitTimeout();
  cy.get('#question_input_key').type('{enter}');
  typeEnter();
  waitTimeout();
  typeEnter();

  // Proceed to main game loop
  typeEnter();
  typeEnter();
}

function playCALFIntro() {
  waitTimeout();

  //   Click textbox and enter random participantId
  cy.get('#input-0').type(`${participantId} {enter}`);
  waitTimeout();
  typeEnter();
  waitTimeout();

  //   Click enter
  cy.get('body').type('1 {enter}');
  waitTimeout();

  typeEnter();
  waitTimeout();

  //   Click backspace
  cy.get('body').type('{backspace}');
  waitTimeout();

  // Input example number, enter x1
  cy.get('#practice_number').type('10');
  waitTimeout();

  cy.get('#practice_number').type('{enter}');
  typeEnter();
  waitTimeout();

  //   Enter x2
  //cy.get("body").type("x2 {enter}");
  typeEnter();
  typeEnter();
  //waitTimeout();

  //   Type 4, enter x2
  cy.get('#question_input_key').type('46');
  waitTimeout();
  cy.get('#question_input_key').type('{enter}');
  typeEnter();
  waitTimeout();
  typeEnter();

  //   Type 2, enter x2
  cy.get('#question_input_key').type('37');
  waitTimeout();
  cy.get('#question_input_key').type('{enter}');
  typeEnter();
  waitTimeout();
  typeEnter();

  // Proceed to main game loop
  typeEnter();
  typeEnter();
}

function playFluencyLoop() {
  cy.get('#question_input_key').type(questionInput);
  waitTimeout();
  cy.get('#question_input_key').type('{enter}');
  waitTimeout();
}

function checkGameComplete(endText, continueText = null) {
  cy.get('body')
    .invoke('text')
    .then((text) => {
      if (text.includes(endText)) {
        cy.get('body')
          .should('contain', endText)
          .then(() => {
            cy.get('body').type('{enter}');
          });
        cy.log('Game complete.');
      } else if (continueText && text.includes(continueText)) {
        cy.log('Game break found with text', continueText);
        cy.get('body').type('{enter}');
      } else {
        cy.log('Continuing game...');
        playFluencyLoop();
        checkGameComplete(endText);
      }
    });
}

export function playARF({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  task = 'fluency-arf',
  optional = false,
  endText = 'You are all done.',
  continueText = null,
  auth = 'username',
} = {}) {
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  cy.visit('/');
  if (auth === 'clever') {
    cy.loginWithClever(CLEVER_SCHOOL_NAME, CLEVER_USERNAME, CLEVER_PASSWORD);
  } else if (auth === 'username') {
    cy.login(PARTICIPANT_USERNAME, PARTICIPANT_PASSWORD);
    cy.visit('/');
  }

  cy.selectAdministration(administration);

<<<<<<< HEAD
  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language][task].gameTab).should('exist');
=======
  cy.get('.p-tabview').contains(languageOptions[language][task].gameTab).should('exist');
>>>>>>> ff30ee22 (Remove arbitrary timeout overrides)
  cy.visit(`/game/${task}`);

  //   Click jspsych button to begin
  cy.get('.jspsych-btn').should('be.visible').click();

  playARFIntro();
  checkGameComplete(endText, continueText);

  //  Check if game is marked as complete on the dashboard
  cy.visit('/');
  cy.wait(1);
  cy.selectAdministration(administration);
<<<<<<< HEAD
  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language][task].gameTab).should('exist');
=======
  cy.get('.p-tabview').contains(languageOptions[language][task].gameTab).should('exist');
>>>>>>> ff30ee22 (Remove arbitrary timeout overrides)
}

export function playCALF({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  task = 'fluency-calf',
  optional = false,
  endText = 'You are all done.',
  continueText = null,
  auth = 'username',
} = {}) {
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  cy.visit('/');
  if (auth === 'clever') {
    cy.loginWithClever(CLEVER_SCHOOL_NAME, CLEVER_USERNAME, CLEVER_PASSWORD);
  } else if (auth === 'username') {
    cy.login(PARTICIPANT_USERNAME, PARTICIPANT_PASSWORD);
    cy.visit('/');
  }

  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language][task].gameTab).should('exist');
  cy.visit(`/game/${task}`);

  //   Click jspsych button to begin
  cy.get('.jspsych-btn').should('be.visible').click();

  playCALFIntro();
  checkGameComplete(endText, continueText);

  //  Check if game is marked as complete on the dashboard
  cy.visit('/');
  cy.wait(1);
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language][task].gameTab).should('exist');
}
