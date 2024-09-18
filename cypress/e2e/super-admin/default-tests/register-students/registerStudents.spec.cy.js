const timeout = Cypress.env('timeout');
const selector = '.p-datatable-thead > tr > :nth-child';
function selectField(int, fieldName) {
  // cy.get(`.p-dropdown-label`).should('exist').click().get('li').contains(fieldName).click();
  cy.get(selector + `(${int})`)
    .should('exist')
    .click()
    .get('li')
    .contains(fieldName)
    .click();
}

describe(
  'The admin user can upload a .csv file of student data and assign them to ' + 'the appropriate fields.',
  () => {
    it(
      'Navigates to the RegisterStudents component, uploads a .csv of test student data,' +
        'assigns the data to the appropriate field, and submits the data for registration.',
      () => {
        cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
        cy.visit('/');
        cy.wait(0.3 * Cypress.env('timeout'));
        cy.get('.p-menuitem-link').contains('Users').click();
        cy.get('ul > li', { timeout: 2 * timeout })
          .contains('Register students')
          .click();

        cy.get('input[type=file]').selectFile('cypress/fixtures/testStudentData.csv', { force: true, timeout: 10000 });

        selectField(1, 'Student Username');
        selectField(2, 'Password');
        selectField(3, 'Student Date of Birth');
        selectField(4, 'Grade');
        selectField(5, 'District');
        selectField(6, 'School');
        selectField(7, 'Class');
        selectField(8, 'Group');

        cy.get('div').contains('All users are test accounts').click();
        cy.get('[data-cy="button-start-registration"]').click();
        cy.get('body', { timeout: timeout }).should('contain', 'Success');
      },
    );
  },
);
