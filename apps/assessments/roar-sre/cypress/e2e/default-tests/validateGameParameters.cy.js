// Game parameters now come from the fetched task variant (GET /v1/task-variants/:id),
// not from URL query params. useParameterValidation is still a URL param that gates
// whether AJV schema validation runs. Invalid params produce a console.warn (not a throw).

// Distinct from playSREDefault.cy.js's VARIANT_ID (…0001) to prevent intercept
// collision when Cypress runs both specs in the same session.
const VARIANT_ID = 'aaaaaaaa-0000-0000-0000-000000000000';

const makeVariantResponse = (params) => ({
  data: {
    id: VARIANT_ID,
    taskId: 'bbbbbbbb-0000-0000-0000-000000000000',
    name: null,
    description: null,
    status: 'published',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: null,
    taskName: 'SRE',
    taskSlug: 'roar-sre',
    taskImage: null,
    parameters: Object.entries(params).map(([name, value]) => ({ name, value })),
  },
});

const stubApiCalls = (variantParams) => {
  cy.intercept('POST', '**/users/anonymous', {
    statusCode: 200,
    body: { data: { id: 'test-participant-id' } },
  }).as('createAnonymousUser');

  cy.intercept('GET', `**/task-variants/${VARIANT_ID}`, {
    statusCode: 200,
    body: makeVariantResponse(variantParams),
  }).as('getVariant');

  cy.intercept('POST', '**/runs', {
    statusCode: 201,
    body: { data: { id: 'test-run-id' } },
  }).as('startRun');
};

describe('Validating variant parameters.', () => {
  const TIMEOUT = Cypress.env('timeout');

  before(() => {
    // Registered once — Cypress.on is global and accumulates across tests if placed in beforeEach.
    Cypress.on('uncaught:exception', () => false);
  });

  beforeEach(() => {
    // cy.on is scoped to the current test and does not accumulate across tests.
    cy.on('window:before:load', (win) => {
      cy.spy(win.console, 'warn').as('consoleWarn');
    });
  });

  it('does not warn when variant parameters are valid', () => {
    stubApiCalls({ userMode: 'default' });
    cy.visit(`${Cypress.env('baseUrl')}/?useParameterValidation=true&variantId=${VARIANT_ID}`);
    // Wait for the first jsPsych screen — confirms initConfig completed without validation errors
    cy.get('.jspsych-btn', { timeout: 5 * TIMEOUT }).should('be.visible');
    cy.get('@consoleWarn').should('not.have.been.calledWithMatch', /\[roar-sre\] Parameter validation warnings/);
  });

  it('warns when variant parameters include an out-of-range value', () => {
    stubApiCalls({ timerLength: 200000 }); // 200000 exceeds the 180000 ms maximum
    cy.visit(`${Cypress.env('baseUrl')}/?useParameterValidation=true&variantId=${VARIANT_ID}`);
    // Wait for the first jsPsych screen — confirms initConfig ran and the warning fired
    cy.get('.jspsych-btn', { timeout: 5 * TIMEOUT }).should('be.visible');
    cy.get('@consoleWarn').should('have.been.calledWithMatch', /\[roar-sre\] Parameter validation warnings/);
  });

  it('warns when variant parameters include an unknown property', () => {
    stubApiCalls({ userMode: 'default', unknownParam: 'foo' });
    cy.visit(`${Cypress.env('baseUrl')}/?useParameterValidation=true&variantId=${VARIANT_ID}`);
    cy.get('.jspsych-btn', { timeout: 5 * TIMEOUT }).should('be.visible');
    cy.get('@consoleWarn').should('have.been.calledWithMatch', /\[roar-sre\] Parameter validation warnings/);
  });

  it('does not warn when useParameterValidation is false, even with invalid params', () => {
    stubApiCalls({ timerLength: 200000 });
    cy.visit(`${Cypress.env('baseUrl')}/?useParameterValidation=false&variantId=${VARIANT_ID}`);
    cy.get('.jspsych-btn', { timeout: 5 * TIMEOUT }).should('be.visible');
    cy.get('@consoleWarn').should('not.have.been.calledWithMatch', /\[roar-sre\] Parameter validation warnings/);
  });
});
