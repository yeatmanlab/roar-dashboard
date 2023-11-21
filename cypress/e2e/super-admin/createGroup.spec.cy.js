describe('The admin user can navigate to the create organizations page, and create a new group.', () => {
  it('Navigates to the create organizations page, creates a new group, and checks that the created ' +
      'group is represented in the list of organizations', () => {

    const testGroupName = "###TestGroup"
    const testGroupInitials = "Tg"
    const stanfordUniversityAddress = Cypress.env('stanfordUniversityAddress')
    const testTag = "stanford university"

    cy.navigateTo('/create-orgs')
    cy.get('[data-cy="dropdown-org-type"]').click()
    cy.get('li').contains('group').click()
    cy.inputOrgDetails(testGroupName, testGroupInitials, null, stanfordUniversityAddress, null, testTag)
    cy.get('[data-cy="button-create-org"]').click().wait(1000)

    // Check that the district is represented in the list of organizations.
    cy.navigateTo('/list-orgs')
    cy.get("a").contains('Groups').click()
    expect(cy.get('div').should('contain.text', testGroupName))
    cy.log("Group successfully created.")

    //   Need a programmatic way to delete the created district.

  })
})