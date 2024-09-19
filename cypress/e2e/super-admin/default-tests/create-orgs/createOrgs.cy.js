import { randomizeName } from '../../../../support/utils';
import {
  selectOrgFromDropdown,
  clickCreateOrg,
  inputParentOrgDetails,
  navigateToPageFromMenubar,
} from '../../../../support/helper-functions/super-admin/superAdminHelpers';

const timeout = Cypress.env('timeout');

const randomDistrictName = randomizeName(Cypress.env('testDistrictName'));
const randomSchoolName = randomizeName(Cypress.env('testSchoolName'));
const randomClassName = randomizeName(Cypress.env('testClassName'));
const randomGroupName = randomizeName(Cypress.env('testGroupName'));

const randomOrgs = [
  { orgType: 'District', name: randomDistrictName, initials: 'CTD', grade: null },
  { orgType: 'School', name: randomSchoolName, initials: 'CTS', parentDistrict: randomDistrictName, grade: null },
  {
    orgType: 'Class',
    name: randomClassName,
    initials: 'CTC',
    parentDistrict: randomDistrictName,
    parentSchool: randomSchoolName,
    grade: 5,
  },
  { orgType: 'Group', name: randomGroupName, initials: 'CTG' },
];

function checkTestData() {
  cy.get('[data-cy="checkbox-test-data-orgs"]', { timeout: Cypress.env('timeout') }).click();
}

function checkSuccess() {
  cy.get('body', { timeout: Cypress.env('timeout') }).should('contain.text', 'Success');
}

describe('The admin user can create a set of test orgs', () => {
  randomOrgs.forEach((org) => {
    it(`Creates a test ${org.orgType}`, () => {
      cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
      cy.visit('/');
      cy.wait(0.3 * Cypress.env('timeout'));

      navigateToPageFromMenubar('Organizations', 'Create organization');

      cy.log(`Creating a ${org.orgType.toLowerCase()} named ${org.name}`);
      selectOrgFromDropdown(org.orgType.toLowerCase());
      inputParentOrgDetails(org.orgType, org?.parentDistrict, org?.parentSchool);
      cy.inputOrgDetails(org.name, org.initials, null, null, org.grade, Cypress.env('testTag'));
      checkTestData();
      clickCreateOrg(org.orgType);
      checkSuccess();
      cy.log('Org successfully created.');
    });
  });
});
