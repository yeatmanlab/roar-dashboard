const testAdministratorFirstName = "###testAdministratorFirstName"
const testAdministratorMiddleName = "###testAdministratorMiddleName"
const testAdministratorLastName = "###testAdministratorLastName"
const testAdministratorEmail = "###testAdministratorEmail"
const testDistrictName = "###TestDistrict"
const testSchoolName = "###TestSchool"
const testClassName = "###TestClass"
const testGroupName = "###TestGroup"
const randomTenDigitNumber = Math.floor(1000000000 + Math.random() * 9000000000)

describe('The admin user can create a new administrator and assign them to a group(s).', () => {
  it('Logs into the dashboard, navigates to the Create Administrator component, ' +
      'creates a new administrator, and assigns the new administrator to a group,', () => {

    cy.navigateTo('/create-administrator', {timeout: 10000})
    cy.get('[data-cy="input-administrator-first-name"]').type(testAdministratorFirstName)
    cy.get('[data-cy="input-administrator-middle-name"]').type(testAdministratorMiddleName)
    cy.get('[data-cy="input-administrator-last-name"]').type(testAdministratorLastName)
    cy.get('[data-cy="input-administrator-email"]').type(`${testAdministratorEmail + randomTenDigitNumber}@testemail.com`)

    cy.selectTestOrgs(testDistrictName, testSchoolName, testClassName, testGroupName)

    cy.get('[data-cy="button-create-administrator"]').click()
    cy.url({timeout: 20000}).should('eq', `${Cypress.env('baseUrl')}/`)
  })
})