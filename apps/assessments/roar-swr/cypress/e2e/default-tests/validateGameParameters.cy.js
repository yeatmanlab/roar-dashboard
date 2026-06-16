// Game parameters now come from the fetched task variant (GET /v1/task-variants/:id),
// not from URL query params. useParameterValidation is still a URL param that gates
// whether AJV schema validation runs. Invalid params produce a console.warn (not a throw).

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
    taskName: 'SWR',
    taskSlug: 'roar-swr',
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

  beforeEach(() => {
    Cypress.on('uncaught:exception', () => false);
    Cypress.on('window:before:load', (win) => {
      cy.spy(win.console, 'warn').as('consoleWarn');
    });
  });

  it('does not warn when variant parameters are valid', () => {
    stubApiCalls({ numNew: 100, userMode: 'shortAdaptive' });
    cy.visit(`${Cypress.env('baseUrl')}/?useParameterValidation=true&variantId=${VARIANT_ID}`);
    // Wait for the first jsPsych screen — confirms initConfig completed without errors
    cy.get('.jspsych-btn', { timeout: 5 * TIMEOUT }).should('be.visible');
    cy.get('@consoleWarn').should('not.have.been.calledWithMatch', /\[roar-swr\] Parameter validation warnings/);
  });

  it('warns when variant parameters include out-of-range values', () => {
    stubApiCalls({ numNew: 2000, userMode: 'shortAdaptive' });
    cy.visit(`${Cypress.env('baseUrl')}/?useParameterValidation=true&variantId=${VARIANT_ID}`);
    // Wait for the first jsPsych screen — confirms initConfig ran and the warning fired
    cy.get('.jspsych-btn', { timeout: 5 * TIMEOUT }).should('be.visible');
    cy.get('@consoleWarn').should('have.been.calledWithMatch', /\[roar-swr\] Parameter validation warnings/);
  });

  it('warns when variant parameters include an unknown property', () => {
    stubApiCalls({ userMode: 'shortAdaptive', unknownParam: 'foo' });
    cy.visit(`${Cypress.env('baseUrl')}/?useParameterValidation=true&variantId=${VARIANT_ID}`);
    cy.get('.jspsych-btn', { timeout: 5 * TIMEOUT }).should('be.visible');
    cy.get('@consoleWarn').should('have.been.calledWithMatch', /\[roar-swr\] Parameter validation warnings/);
  });
});
