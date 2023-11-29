const today = new Date().getDate()

describe('The admin user can create an administration and assign it to a district.', () => {
  it('Logs into the dashboard, navigates to the Create Administrations component,' +
      'creates a new administration, and assigns it to a test district.', () => {

    cy.navigateTo('/create-administration')
    cy.get('[data-cy="input-administration-name"]').type(Cypress.env('testAdministrationName'))
    cy.get('[data-cy="input-calendar"]').click().get('.p-datepicker-today > span').contains(today).click().type('{rightarrow}{rightarrow}{enter}{esc}')

    cy.selectTestOrgs()
    cy.get('ul > li').contains("Elijah Test Group").click()

  //   Temporary fix until assessments properly load without needing to refresh the list.
    cy.get('[data-cy="button-refresh-assessments"]', {timeout: 10000}).click()

    cy.get('span').contains("morphology-default", {timeout: 10000}).dblclick()
    cy.get('span').contains("kNmRHn8Z6nIejzu4nKWU", {timeout: 10000}).dblclick()
    cy.get('[data-cy="button-create-administration"]', {timeout: 10000}).click()

    cy.get('[data-cy="h2-card-admin-title"', {timeout: 20000}).should('contain.text', Cypress.env("testAdministrationName"))
    cy.log("Administration successfully created.")

  })
})