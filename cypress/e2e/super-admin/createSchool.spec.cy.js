describe('The admin user can navigate to the create organizations page, and create a new school.', () => {
  it('Navigates to the create organizations page, creates a new school, and checks that the created ' +
      'school is represented in the list of organizations', () => {

    const testDistrictName = "###CypressTesting"
    const testSchoolName = "###TestSchool"
    const testSchoolInitials = "TS"
    const testSchoolNcesId = "123456789"
    const stanfordUniversityAddress = Cypress.env('stanfordUniversityAddress')
    const testTa = "stanford university"

    cy.navigateTo('/create-orgs')
    cy.get('[data-cy="dropdown-org-type"]').click()
    cy.get('li').contains('school').click().wait(1000)
    expect(cy.get('[data-cy="dropdown-parent-district"]').click().type('{enter}')
        .get('li').should('contain.text', testDistrictName))
    cy.inputOrgDetails(testSchoolName, testSchoolInitials, testSchoolNcesId, stanfordUniversityAddress, null, testTag)
    cy.get('[data-cy="button-create-org"]').click().wait(1000)

    // Check that the district is represented in the list of organizations.
    cy.navigateTo('/list-orgs')
    cy.get("a").contains('Schools').click()
    expect(cy.get('[data-cy="dropdown-parent-district"]').should('contain.text', testDistrictName))
    expect(cy.get('div').should('contain.text', testSchoolName))
    cy.log("School successfully created.")

    //   Need a programmatic way to delete the created district.

  })
})