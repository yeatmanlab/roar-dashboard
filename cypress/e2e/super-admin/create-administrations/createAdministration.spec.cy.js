describe('The admin user can create an administration and assign it to a district.', () => {
  it('Logs into the dashboard, navigates to the Create Administrations component,' +
      'creates a new administration, and assigns it to a test district.', () => {

    const today = new Date().getDate()

    const testAdministrationName = "###TestAdministration"
    const testDistrictName = "###TestDistrict"
    const testSchoolName = "###TestSchool"
    const testClassName = "###TestClass"
    const testGroupNameOne = "###TestGroup"
    const testGroupNameTwo = "Kyle Test Group"

    cy.navigateTo('/create-administration')
    cy.get('[data-cy="input-administration-name"]').type(testAdministrationName)
    cy.get('[data-cy="input-calendar"]').click().get('span').contains(today).click().type('{rightarrow}{enter}{esc}')
    cy.get('span').contains('District').click()
    cy.get('ul > li').contains(testDistrictName).click()

    cy.get('span').contains('Schools').click()
    cy.get('[data-cy="dropdown-selected-district"]').click().get('li').contains(testDistrictName).click()
    cy.get('ul > li').contains(testSchoolName).click()

    cy.get('span').contains('Classes').click()
    cy.get('[data-cy="dropdown-selected-district"]').click().get('li').contains(testDistrictName).click()
    cy.get('[data-cy="dropdown-selected-school"]').click().get('li').contains(testSchoolName).click()
    cy.get('ul > li').contains(testClassName).click()

    cy.get('span').contains('Groups').click()
    cy.get('ul > li').contains(testGroupNameOne).click()
    cy.get('ul > li').contains(testGroupNameTwo).click()

  //   Temporary fix until assessments properly load without needing to refresh the list.
    cy.get('[data-cy="button-refresh-assessments"]', {timeout: 10000}).click()

    cy.get('span').contains("morphology-default", {timeout: 10000}).dblclick()
    cy.get('[data-cy="button-create-administration"]', {timeout: 10000}).click()

    expect(cy.get('[data-cy="h2-card-admin-title"', {timeout: 10000}).should('contain.text', testAdministrationName))
    cy.log("Administration successfully created.")

  })
})