describe('The super admin can log out.', () => {
  it('Logs the user out', () => {

    cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'))
    cy.visit('/')
    cy.wait(5000)
    cy.logout()
  })
})