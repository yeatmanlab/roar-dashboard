const timeout = Cypress.env('timeout');

const listOrgsUrl = '/list-orgs';

describe('Export Org Users test', () => {
  beforeEach(() => {
    cy.login(Cypress.env('partnerAdminUsername'), Cypress.env('partnerAdminPassword'));
    cy.navigateTo('/');
    cy.navigateTo(listOrgsUrl);
  });

  it(`should export ${Cypress.env('testPartnerDistrictName')} organization users as CSV`, () => {
    cy.checkOrgExists();
    cy.get('button').contains('Export Users').click();
    cy.readFile(`${Cypress.env('cypressDownloads')}/cypress-test-district-users-export.csv`);
  });
});
