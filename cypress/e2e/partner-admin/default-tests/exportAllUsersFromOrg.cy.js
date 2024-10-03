const timeout = Cypress.env('timeout');

const listOrgsUrl = '/list-orgs';

function checkOrgExists() {
  cy.get('ul > li', { timeout: timeout }).contains('Districts', { timeout: timeout }).click();

  cy.get('div', { timeout: timeout }).should('contain.text', Cypress.env('testPartnerDistrictName'), {
    timeout: timeout,
  });
  cy.log(`${Cypress.env('testPartnerDistrictName')} exists.`);
}

describe('The partner admin user', () => {
  beforeEach(() => {
    cy.login(Cypress.env('partnerAdminUsername'), Cypress.env('partnerAdminPassword'));
    cy.wait(0.2 * timeout);
    cy.navigateTo('/');
    cy.wait(0.2 * timeout);
    cy.navigateTo(listOrgsUrl, { timeout: timeout });
  });

  context(`when navigating to the ${Cypress.env('testPartnerDistrictName')} tab`, () => {
    it(`should see the organization ${Cypress.env('testPartnerDistrictName')}`, () => {
      checkOrgExists();
      cy.get('button').contains('Export Users').click();
      cy.readFile(`${Cypress.env('cypressDownloads')}/cypress-test-district-users-export.csv`);
    });
  });
});
