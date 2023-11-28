describe('The admin user can navigate to the create organizations page, and create a new class.', () => {
  it('Navigates to the create organizations page, creates a new class, and checks that the created ' +
      'class is represented in the list of organizations', () => {


    cy.navigateTo('/create-orgs')
    cy.get('[data-cy="dropdown-org-type"]').click()
    cy.get('li').contains('class').click().wait(1000)
    cy.get('[data-cy="dropdown-parent-district"]').click().get('li').contains(Cypress.env("testDistrictName")).click()
    cy.get('[data-cy="dropdown-parent-school"]').click().get('li').contains(Cypress.env("testSchoolName")).click()
    cy.inputOrgDetails(Cypress.env("testClassName"), Cypress.env('testClassInitials'),
        null, null, Cypress.env('testGrade'), Cypress.env('testTag'))
    cy.get('[data-cy="button-create-org"]').click().wait(1000)

    // Check that the district is represented in the list of organizations.
    cy.navigateTo('/list-orgs')
    cy.get("a").contains('Classes').click()
    cy.get('[data-cy="dropdown-parent-district"]').click().get('li').contains(Cypress.env("testDistrictName")).click()
    cy.get('[data-cy="dropdown-parent-school"]').click().get('li').contains(Cypress.env("testSchoolName")).click()
    cy.get('div').should('contain.text', Cypress.env("testSchoolName"))
    cy.log("Class successfully created.")

    //   Need a programmatic way to delete the created district.

  })
})