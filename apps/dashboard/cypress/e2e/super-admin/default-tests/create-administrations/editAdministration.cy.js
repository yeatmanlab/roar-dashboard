const administrationId = Cypress.env('testOptionalRoarAppsAdministrationId');
const newAssignedCondition = ['studentData.grade', 'LESS_THAN', '2'];
const newOptionalCondition = ['studentData.grade', 'GREATER_THAN', '4'];

function clickEditButton() {
  cy.get('[data-cy="button-edit-variant"]').first().click();
}

function clickMakeOptionalForAllSwitch() {
  cy.get('[data-cy="switch-optional-for-everyone"]').click();
}

function editAssignedConditions() {
  cy.get('[data-cy="button-assigned-condition"]').click();
  cy.get('[data-cy="dropdown-assigned-field"]').findByTestId('select__dropdown').click();
  cy.get('ul > li').contains('studentData.grade').click();
  cy.get('[data-cy="dropdown-assigned-operator"]').click();
  cy.get('ul > li').contains('Less Than').click();
  cy.get('[data-cy="assigned-value-content"]').type('2');
  cy.findByTestId('row-editor-save').click();
}

function editOptionalConditions() {
  cy.get('[data-cy="button-optional-condition"]').click();
  cy.get('[data-cy="dropdown-optional-field"]').findByTestId('select__dropdown').click();
  cy.get('ul > li').contains('studentData.grade').click();
  cy.get('[data-cy="dropdown-optional-operator"]').click();
  cy.get('ul > li').contains('Greater Than').click();
  cy.get('[data-cy="optional-value-content"]').type('4');
  cy.findByTestId('row-editor-save').click();
}

function saveConditions() {
  cy.get('[data-cy="button-save-conditions"]').click();
}

function checkNewConditions() {
  clickEditButton();
  for (const condition of newAssignedCondition) {
    cy.log(`Checking for assigned condition: ${condition}.`);
    cy.findAllByTestId('datatable__column-bodycell').contains(condition).should('exist');
    cy.log(`Assigned condition: ${condition} found.`);
  }
  for (const condition of newOptionalCondition) {
    cy.log(`Checking for optional condition: ${condition}.`);
    cy.findAllByTestId('datatable__column-bodycell').contains(condition).should('exist');
    cy.log(`Optional condition: ${condition} found.`);
  }
  cy.log('Found all new conditions.');
}

describe('The admin user can edit the conditions of an administration.', () => {
  it(
    'Logs into the dashboard, navigates to the Create Administrations component,' +
      'edits an existing administration, and checks the fields for the appropriate changes..',
    () => {
      cy.login(Cypress.env('SUPER_ADMIN_USERNAME'), Cypress.env('SUPER_ADMIN_PASSWORD'));
      cy.navigateTo('/');
      cy.wait(Cypress.env('timeout'));
      cy.navigateTo(`/administration/edit/${administrationId}/`);
      clickEditButton();
      clickMakeOptionalForAllSwitch();
      editAssignedConditions();
      clickMakeOptionalForAllSwitch();
      editOptionalConditions();
      saveConditions();
      checkNewConditions();
    },
  );
});
