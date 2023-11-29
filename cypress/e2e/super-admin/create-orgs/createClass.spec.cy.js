function selectClassesFromDropdown() {
  cy.get('[data-cy="dropdown-org-type"]', {timeout: Cypress.env('timeout')}).click()
  cy.get('li').contains('class').click()
}

function inputParentOrgDetails() {
  cy.get('[data-cy="dropdown-parent-district"]').click().get('li').contains(Cypress.env("testDistrictName")).click()
  cy.get('[data-cy="dropdown-parent-school"]').click().get('li').contains(Cypress.env("testSchoolName")).click()
}
function createClass() {
  cy.get('[data-cy="button-create-org"]', {timeout: Cypress.env('timeout')}).click()
}

function checkClassCreated() {
  cy.get("a").contains('Classes', {timeout: Cypress.env('timeout')}).click()
  inputParentOrgDetails()
  cy.get('div', {timeout: Cypress.env('timeout')}).should('contain.text', Cypress.env("testSchoolName"))
  cy.log("Class successfully created.")
}

describe('The admin user can navigate to the create organizations page, and create a new class.', () => {
  it('Navigates to the create organizations page, creates a new class, and checks that the created ' +
      'class is represented in the list of organizations', () => {

    cy.navigateTo('/create-orgs')

    selectClassesFromDropdown()
    inputParentOrgDetails()

    cy.inputOrgDetails(Cypress.env("testClassName"), Cypress.env('testClassInitials'),
        null, null, Cypress.env('testGrade'), Cypress.env('testTag'))

    createClass()

    cy.navigateTo('/list-orgs')

    checkClassCreated()

  })
})