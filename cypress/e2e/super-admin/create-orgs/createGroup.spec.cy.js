function selectGroupsFromDropdown() {
  cy.get('[data-cy="dropdown-org-type"]', {timeout: Cypress.env('timeout')}).click()
  cy.get('li').contains('group').click()
}

function createGroup() {
  cy.get('[data-cy="button-create-org"]', {timeout: Cypress.env('timeout')}).click()
}

function checkGroupCreated() {
  cy.get("a").contains('Groups').click()
  cy.get('div', {timeout: Cypress.env('timeout')}).should('contain.text', Cypress.env('testGroupName'))
  cy.log("Group successfully created.")
}

describe('The admin user can navigate to the create organizations page, and create a new group.', () => {
  it('Navigates to the create organizations page, creates a new group, and checks that the created ' +
      'group is represented in the list of organizations', () => {


    cy.navigateTo('/create-orgs')
    selectGroupsFromDropdown()

    cy.inputOrgDetails(Cypress.env('testGroupName'), Cypress.env('testGroupInitials'),
        null, Cypress.env('stanfordUniversityAddress'), null, Cypress.env('testTag'))

    createGroup()

    cy.navigateTo('/list-orgs')

    checkGroupCreated()

  })
})