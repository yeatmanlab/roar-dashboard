const username = Cypress.env('superAdminUsername')

const password = Cypress.env('superAdminPassword')
describe('The super admin can log in using a standard username and password.', () => {
  it('Logs the user in', () => {
    cy.login(username, password)
  })
})