const timeout = Cypress.env('timeout');

const listOrgsUrl = '/list-orgs';

describe('The partner admin user', () => {
  beforeEach(() => {
    cy.login(Cypress.env('partnerAdminUsername'), Cypress.env('partnerAdminPassword'));
    cy.navigateTo('/');
    cy.navigateTo(listOrgsUrl);
  });

  context(`when navigating to the ${Cypress.env('testPartnerDistrictName')} tab`, () => {
    it(`should see the organization ${Cypress.env('testPartnerDistrictName')}`, () => {
      cy.checkOrgExists();
      cy.get('button').contains('Export Users').click();
      cy.readFile(`${Cypress.env('cypressDownloads')}/cypress-test-district-users-export.csv`);
    });
  });
});
