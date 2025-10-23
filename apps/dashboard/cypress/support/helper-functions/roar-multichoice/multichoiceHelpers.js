import { languageOptions } from './languageOptions';

const CLEVER_SCHOOL_NAME = Cypress.env('CLEVER_SCHOOL_NAME');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

const CLICK_SELECTORS = [
  '.go-button',
  '.glowingButton',
  'button.jspsych-btn',
  '#jspsych-content .go-button',
  '#jspsych-content button',
  '[aria-label*="Next"]',
  '[aria-label*="Continue"]',
  '[role="button"]',
];

const timeout = Cypress.env('timeout');

function checkGameTab(language, task) {
  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language][task].gameTab).should('exist');
}

function clickFirstVisible() {
  cy.get('body', { timeout }).then(($body) => {
    for (const sel of CLICK_SELECTORS) {
      const $candidate = $body.find(sel).filter(':visible').first();
      if ($candidate.length) {
        cy.wrap($candidate).click({ force: true });
        return;
      }
    }
    // Fallback for canvas/overlay UIs
    cy.get('body').type('{rightarrow}', { force: true });
  });
}

// Loops until the completion text is present.
function makeChoiceOrContinue(gameCompleteText, tries = 0) {
  if (tries > 800) throw new Error('Exceeded max tries while playing the game.');

  cy.get('body', { timeout: 1000 }).then(($body) => {
    const text = $body.text().replace(/\s\s+/g, ' ').trim();

    // If we see the "all done" message, stop.
    if (text.includes(gameCompleteText)) {
      cy.log('Game is complete.');
      return;
    }

    // If we see feedback like "That's right!" or "Try again", we still need to advance.
    // Either way, attempt to click/advance.
    clickFirstVisible();

    // Small wait to let the next trial render, then recurse.
    cy.wait(150);
    makeChoiceOrContinue(gameCompleteText, tries + 1);
  });
}

export function startGame(administration, language, optional, task, auth) {
  Cypress.on('uncaught:exception', () => false);
  cy.visit('/');

  if (auth === 'username') {
    cy.login(PARTICIPANT_USERNAME, PARTICIPANT_PASSWORD);
    cy.visit('/');
  } else {
    cy.loginWithClever(CLEVER_SCHOOL_NAME, CLEVER_USERNAME, CLEVER_PASSWORD);
  }

  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  checkGameTab(language, task);
  cy.visit(languageOptions[language][task].url);

  cy.waitForAssessmentReadyState();
  cy.get('.jspsych-btn').should('be.visible').click();

  cy.wait(0.1 * Cypress.env('timeout'));
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  cy.get('.go-button').should('be.visible').click();
}

export function playMorphology({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  optional = false,
  task = 'morphology',
  gameCompleteText = "You're all done",
  auth = 'username',
} = {}) {
  startGame(administration, language, optional, task, auth);

  makeChoiceOrContinue(gameCompleteText);
  cy.log('Game finished successfully.');

  cy.visit('/');
  cy.wait(1);
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  checkGameTab(language, task);
  cy.log('Test completed successfully.');
}

export function playWrittenVocabulary({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  optional = false,
  task = 'cva',
  gameCompleteText = "You're all done",
  auth = 'username',
} = {}) {
  startGame(administration, language, optional, task, auth);

  makeChoiceOrContinue(gameCompleteText);
  cy.log('Game finished successfully.');

  cy.visit('/');
  cy.wait(1);
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  checkGameTab(language, task);
  cy.log('Test completed successfully.');
}
