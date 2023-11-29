function inputAdministatorDetails() {
  const randomTenDigitNumber = Math.floor(1000000000 + Math.random() * 9000000000)
  cy.get('[data-cy="input-administrator-first-name"]').type(Cypress.env("testAdministratorFirstName"))
  cy.get('[data-cy="input-administrator-middle-name"]').type(Cypress.env("testAdministratorMiddleName"))
  cy.get('[data-cy="input-administrator-last-name"]').type(Cypress.env("testAdministratorLastName"))
  cy.get('[data-cy="input-administrator-email"]').type(`${Cypress.env("testAdministratorEmail") + randomTenDigitNumber}@testemail.com`)
}

function createAdministrator() {
  cy.get('[data-cy="button-create-administrator"]').click()
}

function checkAdministrationCreated() {
  cy.url({timeout: 2 * Cypress.env('timeout')}).should('eq', `${Cypress.env('baseUrl')}/`)
  cy.log("Administrator successfully created.")
}

describe('The admin user can create a new administrator and assign them to a group(s).', () => {
  it('Logs into the dashboard, navigates to the Create Administrator component, ' +
      'creates a new administrator, and assigns the new administrator to a group,', () => {

    cy.navigateTo('/create-administrator', {timeout: Cypress.env('timeout')})
    inputAdministatorDetails()
    cy.selectTestOrgs()
    createAdministrator()
    checkAdministrationCreated()
  })
})