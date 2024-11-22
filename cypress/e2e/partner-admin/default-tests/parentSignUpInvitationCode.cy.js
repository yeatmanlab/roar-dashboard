const baseUrl = Cypress.config().baseUrl;
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
  cy.get('[data-cy="input-parent-first-name"]').type(Cypress.env('parentFirstName')); // First Name
  cy.get('[data-cy="input-parent-last-name"]').type(Cypress.env('parentLastName')); // Last Name
  cy.get('[data-cy="input-parent-email"]').type(Cypress.env('parentEmail')); // Email
  cy.get('[data-cy="password-parent-password"]').first().type(Cypress.env('parentPassword')); // Password
  cy.get('[data-cy="password-parent-password-confirm"]').type(Cypress.env('parentPassword')); // Confirm Password
  cy.get('.p-checkbox-input').click(); // Terms and Conditions
}

function completeParentSignUp(org) {
  cy.get('button').contains('Continue').click();
  cy.get('button').contains('Next').click();
  cy.get('div').should('contain.text', org.orgVerified);
}

describe('The partner admin user', () => {
  beforeEach(() => {
    cy.login(Cypress.env('PARTNER_ADMIN_USERNAME'), Cypress.env('PARTNER_ADMIN_PASSWORD'));
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
