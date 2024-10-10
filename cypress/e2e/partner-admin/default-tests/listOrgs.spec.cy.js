const orgs = [
  { tabName: 'Districts', orgName: Cypress.env('testPartnerDistrictName') },
  { tabName: 'Schools', orgName: Cypress.env('testPartnerSchoolName') },
  { tabName: 'Classes', orgName: Cypress.env('testPartnerClassName') },
  { tabName: 'Groups', orgName: Cypress.env('testPartnerGroupName') },
];

const listOrgsUrl = '/list-orgs';

function checkOrgExists(org) {
  cy.get('ul > li').contains(org.tabName).click();
  cy.log('Tab ' + org.tabName + ' found.');

  cy.get('div').should('contain.text', org.orgName);
  cy.log(`${org.orgName} exists.`);
}

describe('The partner admin user', () => {
  beforeEach(() => {
    cy.login(Cypress.env('PARTNER_ADMIN_USERNAME'), Cypress.env('PARTNER_ADMIN_PASSWORD'));
    cy.wait(0.2 * Cypress.env('timeout'));
    cy.navigateTo('/');
    cy.wait(0.2 * Cypress.env('timeout'));
    cy.navigateTo(listOrgsUrl);
    // cy.get('button').contains('Organizations').click();
    // cy.get('button').contains('List Organizations').click();
  });

  orgs.forEach((org) => {
    context(`when navigating to the ${org.tabName} tab`, () => {
      it(`should see the organization ${org.orgName}`, () => {
        checkOrgExists(org);
      });
    });
  });
});
