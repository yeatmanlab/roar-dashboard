const baseUrl = Cypress.env('baseUrl');
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
    .parents('tr')
    .find('button')
    .contains('Invite Users') // Ensure the button contains the text "Invite Users"
    .click();

  cy.log(`Invite Users button clicked for ${org.orgName}.`);
}

describe('The partner admin user', () => {
  beforeEach(() => {
    cy.login(Cypress.env('partnerAdminUsername'), Cypress.env('partnerAdminPassword'));
    cy.wait(0.2 * timeout);
    cy.navigateTo('/');
    cy.wait(0.2 * timeout);
    cy.navigateTo(listOrgsUrl, { timeout: timeout });
  });

  orgs.forEach((org) => {
    context(`when navigating to the ${org.tabName} tab`, () => {
      it(`should see the organization ${org.orgName} and should click on Invite Users`, () => {
        checkOrgExists(org);
      });
    });
  });

  after(() => {
    cy.get('i[data-cy="copy-invitation"]')
      .should('exist')
      .parent('button') // Navigate back to the button element
      .click();
    cy.log('Specific copy button clicked.');

    try {
      // Access the copied activation code from the clipboard
      cy.window().then((win) => {
        return win.navigator.clipboard.readText().then((activationCode) => {
          cy.log('Copied activation code: ' + activationCode);
          expect(activationCode).to.not.be.empty;

          // Construct the registration URL with the activation code
          const registerUrl = `${baseUrl}/register/?code=${activationCode}`;

          // Navigate directly to the registration URL
          cy.visit(registerUrl);
          cy.log('Navigated to the registration URL: ' + registerUrl);

          // Fill in the form fields
          cy.get('input[name="firstName"]').type(Cypress.env('parentFirstName'));
          cy.log('Filled in first name.');

          cy.get('input[name="lastName"]').type(Cypress.env('parentLastName'));
          cy.log('Filled in last name.');

          cy.get('input[name="ParentEmail"]').type(Cypress.env('parentEmail'));
          cy.log('Filled in email.');

          cy.get('input[type="password"]').first().type(Cypress.env('parentPassword'));
          cy.log('Filled in password.');

          cy.get('input[type="password"]').eq(1).type(Cypress.env('parentPassword'));
          cy.log('Filled in password confirmation.');

          cy.get('div.p-checkbox-box').click();
          cy.log('Checkbox clicked.');

          cy.wait(2000);

          cy.get(
            'button.p-button.p-component.p-confirm-dialog-accept.bg-primary.text-white.border-none.border-round.p-2.hover\\:bg-red-900',
          ).click();
          cy.log('Clicked the "Continue" button.');

          cy.get('span.p-button-label').contains('Next').click();
          cy.log('Clicked the "Next" button.');

          // Verify that the org is "Groups - Cypress Test Group"
          cy.get('h2.text-primary.h-3.m-0.p-0').should('contain.text', 'Groups - Cypress Test Group');
          cy.log('Verified that "Groups - Cypress Test Group" is visible.');
        });
      });
    } catch (error) {
      cy.log('Error occurred while accessing the clipboard or during navigation: ' + error.message);
    }
  });
});
