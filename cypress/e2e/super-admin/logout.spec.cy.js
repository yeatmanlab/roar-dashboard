describe('The super admin can log out.', () => {
  it('passes', () => {
    const username = Cypress.env('superAdminUsername')
    const password = Cypress.env('superAdminPassword')

    cy.login(username, password)
    cy.visit('/')
    cy.wait(5000)
    cy.logout()
  })
})