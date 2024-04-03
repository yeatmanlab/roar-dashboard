import { randomizeOrgName } from '../../../support/utils';

const randomDistrictName = randomizeOrgName(Cypress.env('testDistrictName'));

function selectDistrictsFromDropdown() {
  cy.get('[data-cy="dropdown-org-type"]', { timeout: Cypress.env('timeout') }).click();
  cy.get('li').contains('district').click();
}

function createDistrict() {
  cy.get('.p-button-label', { timeout: Cypress.env('timeout') })
    .contains('Create District')
    .click();
}

function checkDistrictCreated(_orgName) {
  // cy.get('.p-paginator-last', { timeout: Cypress.env('timeout') })
  //   .first()
  //   .click();
  cy.get('div', { timeout: Cypress.env('timeout') }).should('contain.text', _orgName);
  cy.log('District successfully created.');
}

describe('The admin user can navigate to the create organizations page, and create a new district.', () => {
  it(
    'Navigates to the create organizations page, creates a new district, and checks that the created ' +
      'district is represented in the list of organizations',
    () => {
      cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
      cy.navigateTo('/create-orgs');

      selectDistrictsFromDropdown();

      cy.inputOrgDetails(
        randomDistrictName,
        Cypress.env('testDistrictInitials'),
        Cypress.env('testDistrictNcesId'),
        Cypress.env('stanfordUniversityAddress'),
        null,
        Cypress.env('testTag'),
      );

      createDistrict();

      // allow time for the org to be created
      cy.wait(Cypress.env('timeout'));
      cy.navigateTo('/list-orgs');

      checkDistrictCreated(randomDistrictName);
    },
  );
});
