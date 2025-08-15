import { APP_ROUTES } from '../../../../src/constants/routes';

const PARTNER_ADMIN_USERNAME = Cypress.env('PARTNER_ADMIN_USERNAME');
const PARTNER_ADMIN_PASSWORD = Cypress.env('PARTNER_ADMIN_PASSWORD');
const orgs = [
  { tabName: 'Districts', orgName: Cypress.env('testPartnerDistrictName') },
  { tabName: 'Schools', orgName: Cypress.env('testPartnerSchoolName') },
  { tabName: 'Classes', orgName: Cypress.env('testPartnerClassName') },
  { tabName: 'Groups', orgName: Cypress.env('testPartnerGroupName') },
];

describe('Partner Admin: Orgs', () => {
  orgs.forEach((org) => {
    describe(`${org.tabName} – ${org.orgName}`, () => {
      it(`Lists the org in the data table`, () => {
        // Login as the partner admin.
        cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);

        // Wait to ensure that the login is successful.
        // @NOTE: This is currently required as the app is not immediately ready to navigate to the orgs list page.
        // @TODO: Remove this arbitrary wait once the app initialisation has been refactored and is stable.
        cy.wait(2000);

        cy.navigateTo(APP_ROUTES.ORGS_LIST);

        // Wait for the orgs list page to load.
        cy.waitForOrganisationsList();

        // Navigate to the org tab.
        cy.get('ul > li').contains(org.tabName).click();
        cy.log('Tab ' + org.tabName + ' found.');

        // Validate that the org exists.
        cy.get('div').should('contain.text', org.orgName);
        cy.log(`${org.orgName} exists.`);
      });
    });
  });
});
