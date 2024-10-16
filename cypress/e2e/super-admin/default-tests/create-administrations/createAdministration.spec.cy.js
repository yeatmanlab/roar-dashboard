import { randomizeName } from '../../../../support/utils';
import { navigateToPageFromMenubar } from '../../../../support/helper-functions/super-admin/superAdminHelpers.js';

const timeout = Cypress.env('timeout');
const today = new Date().getDate();
const variant = 'word-school-shortAdaptive-gradeBasedStory';
const assignedvalue = '5';
const assignedvalue2 = 'postsecondary';

const randomAdministrationName = randomizeName(Cypress.env('testAdministrationName'));

function typeAdministrationName() {
  cy.get('[data-cy="input-administration-name"]', { timeout: Cypress.env('timeout') }).type(randomAdministrationName);
  cy.get('[data-cy="input-administration-name-public"]', { timeout: Cypress.env('timeout') }).type(
    `Public ${randomAdministrationName}`,
  );
}

function selectStartDate() {
  // eslint-disable-next-line cypress/unsafe-to-chain-command
  cy.get('[data-cy="input-start-date"]').click().get('.p-datepicker-today > span').contains(today).click();
}

function selectEndDate() {
  // eslint-disable-next-line cypress/unsafe-to-chain-command
  cy.get('[data-cy="input-end-date"]')
    .click()
    .get('.p-datepicker-today > span')
    .contains(today)
    .type('{rightarrow}{enter}{esc}');
}

function editVariantCard(_variant) {
  cy.get('[data-cy="button-edit-variant"]', { timeout: Cypress.env('timeout') }).type(_variant);
}

function addCondition(_variant, _assignedvalue) {
  cy.get('[data-cy="button-assigned-condition"]', { timeout: Cypress.env('timeout') }).type(_variant);
  cy.get('[data-cy="dropdown-assigned-field"]', { timeout: 2 * Cypress.env('timeout') }).type('{enter}');
  cy.get('ul > li', { timeout: Cypress.env('timeout') })
    .contains('studentData.grade')
    .click();
  cy.get('[data-cy="dropdown-assigned-operator"]', { timeout: 2 * Cypress.env('timeout') }).click();
  cy.get('ul > li', { timeout: Cypress.env('timeout') })
    .contains('>')
    .click();
  cy.get('[data-cy="assigned-value-content"]', { timeout: Cypress.env('timeout') }).type(_assignedvalue);
  cy.get('.p-row-editor-save', { timeout: Cypress.env('timeout') }).click();
  cy.wait(0.2 * timeout);
}

function makeOptional(_variant) {
  cy.get('[data-cy="switch-optional-for-everyone"]', { timeout: Cypress.env('timeout') }).type(_variant);
  // saving
  cy.get('[data-cy="button-save-conditions"]', { timeout: Cypress.env('timeout') }).type(_variant);
  cy.wait(0.2 * timeout);
}

function inputParameters() {
  // adding a condition
  editVariantCard(variant);
  addCondition(variant, assignedvalue);
  // adding a second condition
  addCondition(variant, assignedvalue2);
  // make optional for the rest of the students
  makeOptional(variant);
}

function selectVariantCard(variant) {
  cy.get('[data-cy="selected-variant"]', { timeout: Cypress.env('timeout') })
    .first()
    .type(variant);
  inputParameters();
}

function selectOptions() {
  cy.get('[data-cy="radio-button-not-sequential"]', { timeout: Cypress.env('timeout') }).click();
  cy.get('[data-cy="checkbutton-test-data"]', { timeout: Cypress.env('timeout') }).click();
  cy.get('[data-cy="checkbox-no-consent"]', { timeout: Cypress.env('timeout') }).click();
}

function selectAndAssignAdministration(variant) {
  cy.get('[data-cy="input-variant-name"]', { timeout: Cypress.env('timeout') }).type(variant);
  cy.wait(0.3 * timeout);
  selectVariantCard(variant);
  selectOptions();
  cy.wait(0.3 * timeout);
  cy.get('[data-cy="button-create-administration"]', { timeout: Cypress.env('timeout') }).click();
}

function checkSuccess() {
  cy.get('body', { timeout: Cypress.env('timeout') }).should('contain.text', 'Success');
}

// function checkAdministrationCreated() {
//   cy.url({ timeout: 3 * Cypress.env('timeout') }).should('eq', `${Cypress.env('baseUrl')}/`);
//   cy.wait(timeout);
//   cy.switchToTestAdministrations();
//   cy.wait(0.5 * timeout);
//   cy.get('[data-cy="dropdown-sort-administrations"]', { timeout: 2 * Cypress.env('timeout') }).click();
//   cy.get('ul > li', { timeout: Cypress.env('timeout') })
//     .contains('Creation date (descending)')
//     .click();
//   cy.log(`Looking for ${randomAdministrationName}...`);
//   cy.get('[data-cy="h2-card-admin-title"]', { timeout: 2 * Cypress.env('timeout') }).should(
//     'contain.text',
//     randomAdministrationName,
//   );
//   cy.log('Administration successfully created.');
// }

describe('The admin user can create an administration and assign it to a district.', () => {
  it(
    'Logs into the dashboard, navigates to the Create Administrations component,' +
      'creates a new administration, and assigns it to a test district.',
    () => {
      cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
      cy.navigateTo('/');
      cy.wait(0.3 * timeout);

      navigateToPageFromMenubar('Administrations', 'Create administration');

      cy.wait(0.3 * timeout);
      typeAdministrationName();
      cy.wait(0.3 * timeout);
      selectStartDate();
      cy.wait(0.3 * timeout);
      selectEndDate();
      cy.wait(0.3 * timeout);
      cy.selectTestOrgs();
      cy.wait(0.3 * timeout);
      selectAndAssignAdministration(variant);
      checkSuccess();
      // checkAdministrationCreated();
    },
  );
});
