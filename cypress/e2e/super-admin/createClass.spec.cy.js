describe('The admin user can navigate to the create organizations page, and create a new class.', () => {
  it('Navigates to the create organizations page, creates a new class, and checks that the created ' +
      'class is represented in the list of organizations', () => {

    const testDistrictName = "###CypressTesting"
    const testSchoolName = "###TestSchool"
    const testClassName = "###TestClass"
    const testClassInitials = "TC"
    const testGrade = "Grade 12"
    const testTag = "stanford university"

    cy.navigateTo('/create-orgs')
    cy.get('[data-cy="dropdown-org-type"]').click()
    cy.get('li').contains('class').click().wait(1000)
    expect(cy.get('[data-cy="dropdown-parent-district"]').click().type('{enter}')
        .get('li').should('contain.text', testDistrictName))
    expect(cy.get('[data-cy="dropdown-parent-school"]').click().type('{enter}')
        .get('li').should('contain.text', testSchoolName))
    cy.inputOrgDetails(testClassName, testClassInitials, null, null, testGrade, testTag)
    cy.get('[data-cy="button-create-org"]').click().wait(1000)

    // Check that the district is represented in the list of organizations.
    cy.navigateTo('/list-orgs')
    cy.get("a").contains('Classes').click()
    expect(cy.get('[data-cy="dropdown-parent-district"]').should('contain.text', testDistrictName))
    expect(cy.get('[data-cy="dropdown-parent-school"]').should('contain.text', testSchoolName))
    expect(cy.get('div').should('contain.text', testSchoolName))
    cy.log("Class successfully created.")

    //   Need a programmatic way to delete the created district.

  })
})