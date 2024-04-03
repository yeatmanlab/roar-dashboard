import { randomizeOrgName } from '../../../support/utils';

const randomSchoolName = randomizeOrgName(Cypress.env('testSchoolName'));

function selectSchoolsFromDropdown() {
  cy.get('[data-cy="dropdown-org-type"]', { timeout: Cypress.env('timeout') }).click();
  cy.get('li', { timeout: Cypress.env('timeout') })
    .contains('school')
    .click();
}

function inputParentOrgDetails() {
  cy.get('[data-cy="dropdown-parent-district"]', { timeout: Cypress.env('timeout') })
    .wait(1000)
    .click()
    .get('ul > li', { timeout: Cypress.env('timeout') })
    .contains(Cypress.env('testDistrictName'), { timeout: Cypress.env('timeout') })
    .click();
}

function createSchool() {
  cy.get('[data-cy="button-create-org"]', { timeout: Cypress.env('timeout') }).click();
  cy.wait(3000);
}

function checkSchoolCreated(_orgName) {
  cy.get('a')
    .contains('Schools', { timeout: Cypress.env('timeout') })
    .click();
  inputParentOrgDetails();
  cy.get('div', { timeout: Cypress.env('timeout') }).should('contain.text', _orgName);
  cy.log('School successfully created.');
}

describe('The admin user can navigate to the create organizations page, and create a new school.', () => {
  it(
    'Navigates to the create organizations page, creates a new school, and checks that the created ' +
      'school is represented in the list of organizations',
    () => {
      cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
      cy.navigateTo('/create-orgs');

      selectSchoolsFromDropdown();
      inputParentOrgDetails();

      cy.inputOrgDetails(
        randomSchoolName,
        Cypress.env('testSchoolInitials'),
        Cypress.env('testSchoolNcesId'),
        Cypress.env('stanfordUniversityAddress'),
        null,
        Cypress.env('testTag'),
      );

      createSchool();

      // allow time for the org to be created
      cy.wait(Cypress.env('timeout'));
      cy.navigateTo('/list-orgs');
      checkSchoolCreated();
    },
  );
});
