import { randomizeName } from '../../../../support/utils';

const today = new Date().getDate();
const variant = 'word-default';
const assignedvalue = '5';
const assignedvalue2 = 'postsecondary';

const randomAdministrationName = randomizeName(Cypress.env('testAdministrationName'));

function typeAdministrationName() {
  cy.get('[data-cy="input-administration-name"]').type(randomAdministrationName);
  cy.get('[data-cy="input-administration-name-public"]').type(`Public ${randomAdministrationName}`);
}

function selectStartDate() {
  // eslint-disable-next-line cypress/unsafe-to-chain-command
  cy.get('[data-cy="input-start-date"]').click().get('[data-testId="date-picker__today-button"] > span').contains(today).click();
}

function selectEndDate() {
  // eslint-disable-next-line cypress/unsafe-to-chain-command
  cy.get('[data-cy="input-end-date"]')
    .click()
    .get('[data-testId="date-picker__today-button"] > span')
    .contains(today)
    .type('{rightarrow}{enter}{esc}');
}

function editVariantCard(_variant) {
  cy.get('[data-cy="button-edit-variant"]').type(_variant);
}

function addCondition(_variant, _assignedvalue) {
  cy.get('[data-cy="button-assigned-condition"]').type(_variant);
  cy.get('[data-cy="dropdown-assigned-field"]').type('{enter}');
  cy.get('ul > li').contains('studentData.grade').click();
  cy.get('[data-cy="dropdown-assigned-operator"]').click();
  cy.get('ul > li').contains('>').click();
  cy.get('[data-cy="assigned-value-content"]').type(_assignedvalue);
  cy.findByTestId('row-editor-save').click();
  cy.wait(0.2 * Cypress.env('timeout'));
}

function makeOptional(_variant) {
  cy.get('[data-cy="switch-optional-for-everyone"]').type(_variant);
  // saving
  cy.get('[data-cy="button-save-conditions"]').type(_variant);
  cy.wait(0.2 * Cypress.env('timeout'));
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
  cy.get('[data-cy="selected-variant"]').first().type(variant);
  inputParameters();
  cy.get('[data-cy="radio-button-not-sequential"]').type(variant);
  cy.get('[data-cy="checkbutton-test-data"]').type(variant);
}

function selectAndAssignAdministration(variant) {
  cy.get('[data-cy="input-variant-name"]').type(variant);
  cy.wait(Cypress.env('timeout'));
  selectVariantCard(variant);
  cy.get('[data-cy="button-create-administration"]').type(variant);
}

function checkAdministrationCreated() {
  cy.url({ timeout: 2 * Cypress.env('timeout') }).should('eq', `${Cypress.config().baseUrl}/`);
  cy.get('[data-cy="dropdown-sort-administrations"]').click();
  cy.get('ul > li').contains('Creation date (descending)').click();
  cy.get('[data-cy="h2-card-admin-title"]').should('contain.text', randomAdministrationName);
  cy.log('Administration successfully created.');
}

describe('The admin user can create an administration and assign it to a district.', () => {
  it(
    'Logs into the dashboard, navigates to the Create Administrations component,' +
      'creates a new administration, and assigns it to a test district.',
    () => {
      cy.login(Cypress.env('SUPER_ADMIN_USERNAME'), Cypress.env('SUPER_ADMIN_PASSWORD'));
      cy.wait(Cypress.env('timeout'));
      cy.navigateTo('/create-administration');
      typeAdministrationName();
      selectStartDate();
      selectEndDate();
      cy.selectTestOrgs();
      selectAndAssignAdministration(variant);
      checkAdministrationCreated();
    },
  );
});
