const testDistrictId = "7jVdHAcyqf8XQ7wS2Fxr"
const testAdministrationId = "TnCqCLxjjeisUQrpPoBA"
const timeout = Cypress.env('timeout');
const baseUrl = Cypress.env('baseUrl');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');

function checkUrl() {
  cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
  cy.navigateTo('/');
  cy.url({timeout: timeout}).should('eq', `${baseUrl}/`);
}

function checkAdministrationCardTitle() {
  cy.get('[data-cy="h2-card-admin-title"]', {timeout: timeout})
    .should('contain', testPartnerAdministrationName);
}

function clickProgressButton() {
  cy.get('[data-cy="button-details"]', {timeout: timeout}).click();
    cy.get('[data-cy="button-progress"]', {timeout: timeout}).first().click();
    cy.url({timeout: timeout})
        .should('eq', `${baseUrl}/administration/${testAdministrationId}/district/${testDistrictId}`);
}

function checkProgressTags() {
  cy.get('[data-cy="roar-data-table"]', {timeout: timeout})
    .find('tbody', {timeout: timeout})
    .find('tr', {timeout: timeout})
    .find('td', {timeout: timeout})
    .each((td) => {
      cy.get('span.p-tag.p-component', {timeout: timeout}).should('exist');
    });
}

describe('The partner admin can view progress reports for a given administration.', () => {
  beforeEach(() => {
    checkUrl()
  });

  it('Selects an administration and views its progress report', () => {
    checkAdministrationCardTitle()

    clickProgressButton()

    checkProgressTags()
  });
});