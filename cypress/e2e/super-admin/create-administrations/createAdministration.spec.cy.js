const today = new Date().getDate()

function typeAdministrationName() {
  cy.get('[data-cy="input-administration-name"]', {timeout: Cypress.env('timeout')}).type(Cypress.env('testAdministrationName'));
}

function selectDate() {
  cy.get('[data-cy="input-calendar"]').click().get('.p-datepicker-today > span').contains(today)
    .click().type('{rightarrow}{enter}{esc}');
}

function refreshAssessments() {
  cy.get('[data-cy="button-refresh-assessments"]', {timeout: Cypress.env('timeout')}).click();
}

function selectAndAssignAdministration(variant) {
  cy.get('span').contains(variant, {timeout: Cypress.env('timeout')}).dblclick();
  cy.get('[data-cy="button-create-administration"]', {timeout: 2 * Cypress.env('timeout')}).click();
}

function checkAdministrationCreated() {
  cy.url({timeout: 2 * Cypress.env('timeout')}).should('eq', `${Cypress.env('baseUrl')}/`)
  cy.get('[data-cy="h2-card-admin-title"', {timeout: 2 * Cypress.env('timeout')})
    .should('contain.text', Cypress.env('testAdministrationName'));
  cy.log("Administration successfully created.");
}

describe('The admin user can create an administration and assign it to a district.', () => {
  it('Logs into the dashboard, navigates to the Create Administrations component,' +
      'creates a new administration, and assigns it to a test district.', () => {

    cy.navigateTo('/create-administration')

    typeAdministrationName();
    selectDate();
    cy.selectTestOrgs();
    refreshAssessments();
    selectAndAssignAdministration('morphology-default');
    checkAdministrationCreated();
  })
})