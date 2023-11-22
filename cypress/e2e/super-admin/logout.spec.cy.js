const username = Cypress.env('superAdminUsername')
const password = Cypress.env('superAdminPassword')
describe('The super admin can log out.', () => {
  it('Logs the user out', () => {

    cy.login(username, password)
    cy.visit('/')
    cy.wait(5000)
    cy.logout()
  })
})