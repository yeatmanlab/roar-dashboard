describe('The admin user can navigate to the create organizations page, and create a new district.', () => {
  it('Navigates to the create organizations page, creates a new district, and checks that the created ' +
      'district is represented in the list of organizations', () => {


    cy.navigateTo('/create-orgs')
    cy.get('[data-cy="dropdown-org-type"]').click()
    cy.get('li').contains('district').click()
    cy.inputOrgDetails(Cypress.env('testDistrictName'), Cypress.env('testDistrictInitials'),
        Cypress.env('testDistrictNcesId'), Cypress.env('stanfordUniversityAddress'), null, Cypress.env('testTag'))
    cy.get('[data-cy="button-create-org"]').click().wait(1000)

    // Check that the district is represented in the list of organizations.
    cy.navigateTo('/list-orgs')
    cy.get('div').should('contain.text', Cypress.env('testDistrictName'))
    cy.log("District successfully created.")

  //   Need a programmatic way to delete the created district.

  })
})