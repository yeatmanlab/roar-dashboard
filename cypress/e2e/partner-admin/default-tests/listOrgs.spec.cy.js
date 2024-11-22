const timeout = Cypress.env('timeout');
const orgs = [
  { tabName: 'Districts', orgName: Cypress.env('testPartnerDistrictName') },
  { tabName: 'Schools', orgName: Cypress.env('testPartnerSchoolName') },
  { tabName: 'Classes', orgName: Cypress.env('testPartnerClassName') },
  { tabName: 'Groups', orgName: Cypress.env('testPartnerGroupName') },
];

const listOrgsUrl = '/list-orgs';

function checkOrgExists(org) {
  cy.get('.p-tabview-tablist', { timeout: timeout }).contains(org.tabName, { timeout: timeout }).click();
  cy.log('Tab ' + org.tabName + ' found.');

  cy.get('div', { timeout: timeout }).should('contain.text', org.orgName, {
    timeout: timeout,
  });
  cy.log(`${org.orgName} exists.`);
}

describe('The partner admin user', () => {
  beforeEach(() => {
    cy.login(Cypress.env('PARTNER_ADMIN_USERNAME'), Cypress.env('PARTNER_ADMIN_PASSWORD'));
    cy.wait(0.2 * timeout);
    cy.navigateTo('/');
    cy.wait(0.2 * timeout);
    cy.navigateTo(listOrgsUrl, { timeout: timeout });
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
