const baseUrl = Cypress.env('baseUrl');
import { APP_ROUTES } from '../../../../src/constants/routes';

const orgs = [
  {
    tabName: 'Districts',
    orgName: Cypress.env('testPartnerDistrictName'),
    orgVerified: 'Districts - Cypress Test District',
  },
];

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
  cy.get('div').should('contain.text', org.orgVerified);
}

describe('The partner admin user', () => {
  beforeEach(() => {
    cy.login(Cypress.env('partnerAdminUsername'), Cypress.env('partnerAdminPassword'));
    cy.visit(APP_ROUTES.HOME);
    cy.visit(APP_ROUTES.LIST_ORGS);
  });

  orgs.forEach((org) => {
    context(`when navigating to the ${org.tabName} tab`, () => {
      it(`should see the organization ${org.orgName} and should click on Invite Users`, () => {
        cy.checkOrgExists(org);

        // Locate the row with the orgName and click the "Invite Users" button specifically for that org
        cy.contains('td', org.orgName)
          .parents('tr')
          .find('button')
          .contains('Invite Users') // Ensure the button contains the text "Invite Users"
          .click();

        cy.log(`Invite Users button clicked for ${org.orgName}.`);

        // Invoke the activation code input field to get the value
        cy.get('[data-cy="input-text-activation-code"]')
          .invoke('attr', 'value')
          .then((value) => {
            expect(value).to.not.be.empty;

            // Visit the sign-up page with the activation code
            visitSignUpPage(value);
            inputLoginValues();
            completeParentSignUp(org);
          });
      });
    });
  });
});
