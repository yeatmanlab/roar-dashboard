describe('The user can log in using Clever as an identity provider.', () => {
  it('passes', () => {
    cy.visit('https://localhost:5173/')

    cy.get("button").contains("Clever").click()

    //   Need further setup here with OAuth integration (https://docs.cypress.io/guides/end-to-end-testing/auth0-authentication
  })
})