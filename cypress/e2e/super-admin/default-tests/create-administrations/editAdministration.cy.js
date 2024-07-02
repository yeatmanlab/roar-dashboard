const timeout = Cypress.env('timeout');
const administrationId = Cypress.env('testOptionalRoarAppsAdministrationId');
const newAssignedCondition = ['studentData.grade', 'LESS_THAN', '2'];
const newOptionalCondition = ['studentData.grade', 'GREATER_THAN', '4'];

function clickEditButton() {
  cy.get('[data-cy="button-edit-variant"]', { timeout: timeout }).first().click();
}

function clickMakeOptionalForAllSwitch() {
  cy.get('[data-cy="switch-optional-for-everyone"]', { timeout: timeout }).click();
}

function editAssignedConditions() {
  cy.get('[data-cy="button-assigned-condition"]', { timeout: timeout }).click();
  cy.get('[data-cy="dropdown-assigned-field"]', { timeout: timeout }).find('.p-dropdown-trigger').click();
  cy.get('ul > li').contains('studentData.grade').click();
  cy.get('[data-cy="dropdown-assigned-operator"]', { timeout: timeout }).click();
  cy.get('ul > li').contains('Less Than').click();
  cy.get('[data-cy="assigned-value-content"]', { timeout: timeout }).type('2');
  cy.get('.p-row-editor-save', { timeout: Cypress.env('timeout') }).click();
}

function editOptionalConditions() {
  cy.get('[data-cy="button-optional-condition"]', { timeout: timeout }).click();
  cy.get('[data-cy="dropdown-optional-field"]', { timeout: timeout }).find('.p-dropdown-trigger').click();
  cy.get('ul > li').contains('studentData.grade').click();
  cy.get('[data-cy="dropdown-optional-operator"]', { timeout: timeout }).click();
  cy.get('ul > li').contains('Greater Than').click();
  cy.get('[data-cy="optional-value-content"]', { timeout: timeout }).type('4');
  cy.get('.p-row-editor-save', { timeout: Cypress.env('timeout') }).click();
}

function saveConditions() {
  cy.get('[data-cy="button-save-conditions"]', { timeout: timeout }).click();
}

function checkNewConditions() {
  clickEditButton();
  for (const condition of newAssignedCondition) {
    cy.log(`Checking for assigned condition: ${condition}.`);
    cy.get('.p-editable-column', { timeout: timeout }).contains(condition).should('exist');
    cy.log(`Assigned condition: ${condition} found.`);
  }
  for (const condition of newOptionalCondition) {
    cy.log(`Checking for optional condition: ${condition}.`);
    cy.get('.p-editable-column', { timeout: timeout }).contains(condition).should('exist');
    cy.log(`Optional condition: ${condition} found.`);
  }
  cy.log('Found all new conditions.');
}

describe('The admin user can edit the conditions of an administration.', () => {
  it(
    'Logs into the dashboard, navigates to the Create Administrations component,' +
      'edits an existing administration, and checks the fields for the appropriate changes..',
    () => {
      cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
      cy.navigateTo('/');
      cy.wait(0.3 * timeout);
      cy.navigateTo(`/edit-administration/${administrationId}/`);
      clickEditButton();
      clickMakeOptionalForAllSwitch();
      editAssignedConditions();
      editOptionalConditions();
      saveConditions();
      checkNewConditions();
    },
  );
});
