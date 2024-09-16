const timeout = Cypress.env('timeout');
const orgs = [
  { tabName: 'Districts', orgName: Cypress.env('testPartnerDistrictName') },
  { tabName: 'Schools', orgName: Cypress.env('testPartnerSchoolName') },
  { tabName: 'Classes', orgName: Cypress.env('testPartnerClassName') },
  { tabName: 'Groups', orgName: Cypress.env('testPartnerGroupName') },
];

const listOrgsUrl = '/list-orgs';

function checkOrgExists(org) {
  // Click the tab that contains the org's name
  cy.get('ul > li', { timeout: timeout }).contains(org.tabName, { timeout: timeout }).click();
  cy.log('Tab ' + org.tabName + ' found.');

  // Check if the organization exists by confirming the org name in the table
  cy.get('div', { timeout: timeout }).should('contain.text', org.orgName, {
    timeout: timeout,
  });
  cy.log(`${org.orgName} exists.`);

  // Locate the row with the orgName and click the "Invite Users" button specifically for that org
  cy.contains('td', org.orgName, { timeout: timeout })
    .parents('tr') // Traverse up to the row element
    .find('button') // Find the button within that row
    .contains('Invite Users') // Ensure the button contains the text "Invite Users"
    .click(); // Click the button

  cy.log(`Invite Users button clicked for ${org.orgName}.`);
}

describe('The partner admin user', () => {
  beforeEach(() => {
    cy.login(Cypress.env('partnerAdminUsername'), Cypress.env('partnerAdminPassword'));
    cy.wait(0.2 * timeout);
    cy.navigateTo('/');
    cy.wait(0.2 * timeout);
    cy.navigateTo(listOrgsUrl, { timeout: timeout });
    // cy.get('button').contains('Organizations').click();
    // cy.get('button').contains('List Organizations').click();
  });

  orgs.forEach((org) => {
    context(`when navigating to the ${org.tabName} tab`, () => {
      it(`should see the organization ${org.orgName} and should click on Invite Users`, () => {
        checkOrgExists(org);
      });
    });
  });
});
