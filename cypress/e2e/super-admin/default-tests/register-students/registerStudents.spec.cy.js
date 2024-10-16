import { navigateToPageFromMenubar } from '../../../../support/helper-functions/super-admin/superAdminHelpers.js';

const timeout = Cypress.env('timeout');
const selector = '.p-datatable-thead > tr > :nth-child';
const filepath = 'cypress/fixtures/super-admin/testStudentData.csv';

// This function clicks the dropdown menu, which is indexed by int, then clicks the field.
function selectField(int, fieldName) {
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

        navigateToPageFromMenubar('Users', 'Register students');

        cy.get('input[type=file]').selectFile(filepath, {
          force: true,
          timeout: 10000,
        });

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
