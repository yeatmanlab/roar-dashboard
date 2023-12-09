const orgs = [
  { tabName: 'Districts', orgName: Cypress.env('testPartnerDistrictName') },
  { tabName: 'Schools', orgName: Cypress.env('testPartnerSchoolName') },
  { tabName: 'Classes', orgName: Cypress.env('testPartnerClassName') },
  { tabName: 'Groups', orgName: Cypress.env('testPartnerGroupName') },
];

const listOrgsUrl = '/list-orgs';

function checkOrgExists(org) {
  cy.get('ul > li', { timeout: Cypress.env('timeout') })
    .contains(org.tabName)
    .click();
  cy.log('Tab ' + org.tabName + ' found.');

  cy.get('div', { timeout: Cypress.env('timeout') }).should('contain.text', org.orgName, {
    timeout: Cypress.env('timeout'),
  });
  cy.log(`${org.orgName} exists.`);
}

describe('The partner admin user', () => {
  beforeEach(() => {
    cy.login(Cypress.env('partnerAdminUsername'), Cypress.env('partnerAdminPassword'));
    cy.navigateTo(listOrgsUrl);
  });

  orgs.forEach((org) => {
    context(`when navigating to the ${org.tabName} tab`, () => {
      it(`should see the organization ${org.orgName}`, () => {
        checkOrgExists(org);
      });
    });
  });
});
