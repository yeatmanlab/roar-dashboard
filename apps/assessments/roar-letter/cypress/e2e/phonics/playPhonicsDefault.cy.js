// Task type is determined by the task variant parameters fetched from the backend,
// not by a URL query param. We stub the variant endpoint to return task: 'phonics'
// and visit with ?variantId= so serve.js resolves the correct variant.
const PHONICS_VARIANT_ID = 'aaaaaaaa-0001-0000-0000-000000000000';

const timeout = Cypress.env('timeout');
const gameCompleteText = "You're all done!";

const stubBootstrap = () => {
  cy.intercept('POST', '**/users/anonymous', {
    statusCode: 200,
    body: { data: { id: 'test-participant-id' } },
  }).as('createAnonymousUser');

  cy.intercept('GET', `**/task-variants/${PHONICS_VARIANT_ID}`, {
    statusCode: 200,
    body: {
      data: {
        id: PHONICS_VARIANT_ID,
        taskId: 'bbbbbbbb-0000-0000-0000-000000000000',
        name: null,
        description: null,
        status: 'published',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: null,
        taskName: 'Letter',
        taskSlug: 'roar-letter',
        taskImage: null,
        parameters: [
          { name: 'task', value: 'phonics' },
          { name: 'itemSelectMethod', value: 'random' },
          { name: 'phonicsSet', value: 'A' },
          { name: 'stimulusCorpus', value: 'roar-phonics-2025-08-01-v3' },
        ],
      },
    },
  }).as('getVariant');

  cy.intercept('POST', '**/runs', {
    statusCode: 201,
    body: { data: { id: 'test-run-id' } },
  }).as('startRun');

  cy.intercept('POST', '**/runs/*/event', {
    statusCode: 201,
    body: {},
  }).as('runEvent');
};

/**
 * Drives the game forward one step. On each call:
 * 1. If the game-complete heading is visible → done, do nothing.
 * 2. If a break/go-button screen is showing → click it and recurse.
 * 3. Otherwise → click a trial answer button and recurse.
 *
 * Recursion is bounded by maxSteps to prevent infinite loops if the game
 * never reaches the end screen.
 */
function playStep(maxSteps) {
  if (maxSteps <= 0) return;

  cy.wait(0.2 * timeout);

  cy.get('body').then((body) => {
    if (body.find('h1').filter(`:contains("${gameCompleteText}")`).length > 0) {
      // Game is over — stop recursing.
      return;
    }

    if (body.find('.go-button').length > 0) {
      cy.get('.go-button').click();
    } else if (body.find('.glowingButton').length > 0) {
      cy.get('.glowingButton').click();
    } else {
      cy.get('button').first().click();
    }

    playStep(maxSteps - 1);
  });
}

describe('Test play through of ROAR-Letter phonics as a participant', () => {
  beforeEach(() => {
    Cypress.on('uncaught:exception', () => false);
    stubBootstrap();
  });

  it('Plays through ROAR-Letter Phonics', () => {
    cy.visit(`${Cypress.env('baseUrl')}/?variantId=${PHONICS_VARIANT_ID}`);

    cy.get('.jspsych-btn', { timeout: 2 * timeout })
      .should('be.visible')
      .click();

    playStep(200);

    cy.log('Checking if game completed.');
    cy.get('h1').contains(gameCompleteText).should('be.visible');
  });
});
