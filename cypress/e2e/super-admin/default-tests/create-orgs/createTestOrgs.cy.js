import { randomizeName } from '../../../../support/utils';
import {
  selectOrgFromDropdown,
  checkOrgCreated,
  clickCreateOrg,
  inputParentOrgDetails,
} from '../../../../support/helper-functions/super-admin/superAdminHelpers';

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

describe('The admin user can create a set of test orgs', () => {
  randomOrgs.forEach((org) => {
    it(`Creates a test ${org.orgType}`, () => {
      cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
      cy.navigateTo('/create-orgs');
      cy.log(`Creating a ${org.orgType.toLowerCase()} named ${org.name}`);
      selectOrgFromDropdown(org.orgType.toLowerCase());
      inputParentOrgDetails(org.orgType, org?.parentDistrict, org?.parentSchool);
      cy.inputOrgDetails(org.name, org.initials, null, null, org.grade, Cypress.env('testTag'));
      clickCreateOrg(org.orgType);
      // allow time for the org to be created
      cy.wait(Cypress.env('timeout'));
      cy.navigateTo('/list-orgs');
      checkOrgCreated(org.name, org.orgType, org.parentDistrict, org.parentSchool);
      //   Need a way to filter/searc for the randomly created org (maybe use Firestore instead of UI)
    });
  });
});
