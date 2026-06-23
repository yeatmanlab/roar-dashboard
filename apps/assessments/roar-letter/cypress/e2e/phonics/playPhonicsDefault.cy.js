// Task type is determined by the task variant parameters fetched from the backend,
// not by a URL query param. We stub the variant endpoint to return task: 'phonics'
// and visit with ?variantId= so serve.js resolves the correct variant.
const PHONICS_VARIANT_ID = 'aaaaaaaa-0001-0000-0000-000000000000';

const timeout = Cypress.env('timeout');
// 9 intro iterations plus 2 stimulus block iterations
const variantIterations = 12;
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

function makeChoiceOrContinue(overflow, iterations) {
  cy.wait(0.2 * timeout);
  cy.get('body').then((body) => {
    //   If a go button is found, click it and then return to playMultichoice loop
    if (body.find('.go-button').length > 0) {
      //   On the last iteration, check if the game is completed
      if (iterations === variantIterations - 1) {
        cy.log('Checking if game completed.');
        cy.get('h1').contains(gameCompleteText).should('be.visible');
      }
      cy.get('.go-button').click();
    } else {
      //   Only enters this else-block if a go button was not pressed
      if (body.find('.glowingButton').length > 0) {
        cy.get('.glowingButton').click();
      } else {
        cy.get('button').first().click();
      }
      // Either presses the glowing button during the tutorial or presses the first button of the stimulus trials, then iterates the overflow
      if (overflow < 100) {
        makeChoiceOrContinue(overflow + 1, iterations);
      }
    }
  });
}

function playPhonics(iterations) {
  // overflow prevents recursive call from recursing forever
  const overflow = 0;
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < iterations; i++) {
    cy.log('iteration: ', i);
    makeChoiceOrContinue(overflow, i);
  }
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

    playPhonics(variantIterations);
  });
});
