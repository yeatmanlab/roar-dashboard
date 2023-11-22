const testDistrictName = "###TestDistrict"
const testDistrictInitials = "TD"
const testDistrictNcesId = "123456789"
const stanfordUniversityAddress = Cypress.env('stanfordUniversityAddress')
const testTag = "stanford university"

describe('The admin user can navigate to the create organizations page, and create a new district.', () => {
  it('Navigates to the create organizations page, creates a new district, and checks that the created ' +
      'district is represented in the list of organizations', () => {


    cy.navigateTo('/create-orgs')
    cy.get('[data-cy="dropdown-org-type"]').click()
    cy.get('li').contains('district').click()
    cy.inputOrgDetails(testDistrictName, testDistrictInitials, testDistrictNcesId, stanfordUniversityAddress, null, testTag)
    cy.get('[data-cy="button-create-org"]').click().wait(1000)

    // Check that the district is represented in the list of organizations.
    cy.navigateTo('/list-orgs')
    cy.get('div').should('contain.text', testDistrictName)
    cy.log("District successfully created.")

  //   Need a programmatic way to delete the created district.

  })
})