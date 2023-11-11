describe('The user can log in using Google as an identity provider.', () => {
  it('passes', () => {
    cy.visit('/')

    cy.get("button").contains("Google").click()
    cy.get("iframe").should('be.visible')
    // cy.loginByGoogleApi()

  })
})
  //   Need further setup here with Google OAuth integration (https://docs.cypress.io/guides/end-to-end-testing/google-authentication)
