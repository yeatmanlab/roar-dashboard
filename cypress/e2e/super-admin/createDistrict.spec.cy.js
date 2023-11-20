describe('The admin user can navigate to the create organizations page, and create a new district.', () => {
  it('Navigates to the create organizations page, creates a new district, and checks that the created ' +
      'district is represented in the lst of organizations', () => {

    const testDistrictName = "##TestDistrict"
    const testDistrictInitials = "TD"
    const testDistrictNcesId = "123456789"
    const stanfordUniversityAddress = "450 Jane Stanford Way, Stanford, CA 94305, USA"
    const autoCompleteText = "stanford university"

    cy.navigateTo('/create-orgs')
    cy.get('[data-cy="dropdown-org-type"]').click()
    cy.get('li').contains('district').click()
    cy.get('[data-cy="input-org-name"]').type(testDistrictName)
    cy.get('[data-cy="input-org-initials"]').type(testDistrictInitials)
    cy.get('[data-cy="input-nces-id"]').type(testDistrictNcesId)
    cy.get('[data-cy="input-address"]').type(`${stanfordUniversityAddress}`).wait(1000).type('{downarrow}{enter}').wait(1000)
    expect(cy.get('[data-cy="chip-address"]').should('contain.text', stanfordUniversityAddress))
    cy.get('[data-cy="input-autocomplete"]').type(autoCompleteText).wait(1000).type('{downarrow}{enter}')
    cy.get('[data-pc-section="dropdownbutton"]').click()
    cy.get('li').contains('test').click()
    cy.get('[data-cy="button-create-org"]').click().wait(1000)

    // Check that the district is represented in the list of organizations.
    cy.navigateTo('/list-orgs')
    expect(cy.get('div').should('contain.text', testDistrictName))
    cy.log("District successfully created.")

  //   Need a programmatic way to delete the created district.

  })
})