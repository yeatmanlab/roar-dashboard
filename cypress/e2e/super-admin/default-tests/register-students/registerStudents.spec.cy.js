const timeout = Cypress.env('timeout');

function selectField(id, fieldName) {
  cy.get(`#${id} > .p-dropdown-label`).should('exist').click().get('li').contains(fieldName).click();
}

describe(
  'The admin user can upload a .csv file of student data and assign them to ' + 'the appropriate fields.',
  () => {
    it(
      'Navigates to the RegisterStudents component, uploads a .csv of test student data,' +
        'assigns the data to the appropriate field, and submits the data for registration.',
      () => {
        cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
        cy.get('.p-menuitem-link').contains('Users').click();
        cy.get('ul > li', { timeout: 2 * timeout }).contains('Register students');

        cy.get('input[type=file]').selectFile('cypress/fixtures/testStudentData.csv', { force: true, timeout: 10000 });

        selectField('pv_id_7', 'Student Username');
        selectField('pv_id_8', 'Password');
        selectField('pv_id_9', 'Student Date of Birth');
        selectField('pv_id_10', 'Grade');
        selectField('pv_id_11', 'District');
        selectField('pv_id_12', 'School');
        selectField('pv_id_13', 'Class');
        selectField('pv_id_14', 'Group');

        cy.get('div').contains('All users are test accounts').click();
        cy.get('[data-cy="button-start-registration"]').click();
      },
    );
  },
);
