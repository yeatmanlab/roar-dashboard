import { randomizeName } from '../../../../support/utils';

const timeout = Cypress.env('timeout');
const randomTenDigitNumber = Math.floor(1000000000 + Math.random() * 9000000000);
const randomAdministratorFirstName = randomizeName(Cypress.env('testAdministratorFirstName'));
const randomAdministratorMiddleName = randomizeName(Cypress.env('testAdministratorMiddleName'));
const randomAdministratorLastName = randomizeName(Cypress.env('testAdministratorLastName'));
const randomAdministratorEmail = Cypress.env('testAdministratorEmail') + randomTenDigitNumber + '@testemail.com';

function inputAdministratorDetails() {
  cy.get('[data-cy="input-administrator-first-name"]').type(randomAdministratorFirstName);
  cy.get('[data-cy="input-administrator-middle-name"]').type(randomAdministratorMiddleName);
  cy.get('[data-cy="input-administrator-last-name"]').type(randomAdministratorLastName);
  cy.get('[data-cy="input-administrator-email"]').type(randomAdministratorEmail);
}

function createAdministrator() {
  cy.get('[data-cy="button-create-administrator"]').click();
}

function checkAdministratorCreated() {
  cy.url({ timeout: 2 * Cypress.env('timeout') }).should('eq', `${Cypress.env('baseUrl')}/`);
  cy.log('Administrator successfully created.');
  //   Need to expand the checks on this spec
}

describe('The admin user can create a new administrator and assign them to a group(s).', () => {
  it(
    'Logs into the dashboard, navigates to the Create Administrator component, ' +
      'creates a new administrator, and assigns the new administrator to a group,',
    () => {
      cy.login(Cypress.env('SUPER_ADMIN_USERNAME'), Cypress.env('SUPER_ADMIN_PASSWORD'));
      cy.navigateTo('/create-administrator');
      cy.wait(0.5 * timeout);
      inputAdministratorDetails();
      cy.selectTestOrgs();
      createAdministrator();
      checkAdministratorCreated();
    },
  );
});
