import { loginAndNavigateToOrgs, checkOrgExists } from './commands';

const timeout = Cypress.env('timeout');

// The specific organization to select
const selectedOrg = { tabName: 'Districts', orgName: Cypress.env('testPartnerDistrictName') };

// Function to locate and click the "Invite Users" button for the specific org
function clickInviteUsersForOrg(orgName) {
  // Locate the table row containing the specified orgName
  cy.contains('td', orgName, { timeout: timeout })
    .parents('tr') // Traverse up to the row element
    .find('button[data-cy="event-button"]') // Locate the "Invite Users" button within the same row
    .click(); // Click the button

  cy.log(`Invite Users button clicked for ${orgName}.`);
}

describe('The partner admin user', () => {
  beforeEach(() => {
    loginAndNavigateToOrgs(timeout);
  });

  context(`when navigating to the ${selectedOrg.tabName} tab`, () => {
    it(`should see the organization ${selectedOrg.orgName} and click the Invite Users button`, () => {
      checkOrgExists(selectedOrg, timeout);
      cy.wait(0.5 * timeout); // Optional wait if needed for UI updates

      // Click the "Invite Users" button for the selected organization
      clickInviteUsersForOrg(selectedOrg.orgName);
    });
  });
});
