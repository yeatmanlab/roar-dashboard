const baseUrl = Cypress.env('baseUrl');
const timeout = Cypress.env('timeout');
const listOrgsUrl = '/list-orgs';
const orgs = [
  {
    tabName: 'Districts',
    orgName: Cypress.env('testPartnerDistrictName'),
    orgVerified: 'Districts - Cypress Test District',
  },
];

function checkOrgExists(org) {
  // Click the tab that contains the org name
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

function visitSignUpPage(activationCode) {
  const registerUrl = `${baseUrl}/register/?code=${activationCode}`;
  cy.visit(registerUrl);
}

function inputLoginValues() {
  cy.get('input[name="firstName"]').type(Cypress.env('parentFirstName'));
  cy.get('input[name="lastName"]').type(Cypress.env('parentLastName'));
  cy.get('input[name="ParentEmail"]').type(Cypress.env('parentEmail'));
  cy.get('input[type="password"]').first().type(Cypress.env('parentPassword'));
  cy.get('input[type="password"]').eq(1).type(Cypress.env('parentPassword'));
}

function completeParentSignUp(org) {
  cy.get('div.p-checkbox-box').click();

  cy.get('button').contains('Continue').click();
  cy.get('button').contains('Next').click();

  cy.get('h2').should('contain.text', org.orgVerified);
}

describe('The partner admin user', () => {
  beforeEach(() => {
    cy.login(Cypress.env('partnerAdminUsername'), Cypress.env('partnerAdminPassword')).then(() => {});
    cy.visit('/');
    cy.visit(listOrgsUrl);
  });

  orgs.forEach((org) => {
    context(`when navigating to the ${org.tabName} tab`, () => {
      it(`should see the organization ${org.orgName} and should click on Invite Users`, () => {
        checkOrgExists(org);

        // Invoke the activation code input field to get the value, then visit the sign-up page
        cy.get('[data-cy="input-text-activation-code"]')
          .invoke('attr', 'value')
          .then((value) => {
            expect(value).to.not.be.empty;

            visitSignUpPage(value);
            inputLoginValues();
            completeParentSignUp(org);
          });
      });
    });
  });
});
