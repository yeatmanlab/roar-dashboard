// consent is now a variant parameter, not a URL parameter. The stub returns no
// consent param so it defaults to true — playIntro clicks through the consent form.

// Distinct from validateGameParameters.cy.js's VARIANT_ID (…0000) to prevent intercept
// collision when Cypress runs both specs in the same session.
const VARIANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const stubBootstrap = () => {
  cy.intercept('POST', '**/users/anonymous', {
    statusCode: 200,
    body: { data: { id: 'test-participant-id' } },
  }).as('createAnonymousUser');

  cy.intercept('GET', `**/task-variants/${VARIANT_ID}`, {
    statusCode: 200,
    body: {
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
        parameters: [],
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

describe('Test play through of SRE as a participant', () => {
  beforeEach(() => {
    Cypress.on('uncaught:exception', () => false);
    stubBootstrap();
  });

  it('ROAR-Sentence Play through Test', () => {
    cy.playSREGame({ variantParams: `variantId=${VARIANT_ID}` });
  });
});
