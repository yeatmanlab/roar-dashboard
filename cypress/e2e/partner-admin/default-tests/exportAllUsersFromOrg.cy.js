import { APP_ROUTES } from '../../../../src/constants/routes';

describe('Export Org Users test', () => {
  beforeEach(() => {
    cy.login(Cypress.env('partnerAdminUsername'), Cypress.env('partnerAdminPassword'));
    cy.navigateTo(APP_ROUTES.HOME);
    cy.navigateTo(APP_ROUTES.LIST_ORGS);
  });

  it(`should export ${Cypress.env('testPartnerDistrictName')} organization users as CSV`, () => {
    cy.checkOrgExists('Districts');
    cy.get('button').contains('Export Users').click();
    cy.readFile(`${Cypress.env('cypressDownloads')}/cypress-test-district-users-export.csv`);
  });
});
