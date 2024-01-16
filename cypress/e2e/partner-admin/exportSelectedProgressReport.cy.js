const timeout = Cypress.env('timeout');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');

function getAdministrationCard() {
  cy.get('[data-cy="h2-card-admin-title"]', {timeout: timeout})
    .filter((index, element) => {
      return Cypress.$(element).text().includes(testPartnerAdministrationName);
    })
    .should('have.length', 1)
    .find('button', {timeout: timeout}).contains("Show details").click()
}

describe('The partner admin can select and export progress reports for a given administration.', () => {
  it('Selects an administration and views its progress report', () => {
    cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
    cy.navigateTo('/');
    getAdministrationCard();
    cy.get('button').contains('Progress').first().click();

    // make a selection
    cy.get('.p-checkbox-box').first().click();

    cy.get('button').contains('Export Selected').click();
    cy.readFile(`${Cypress.env('cypressDownloads')}/roar-progress-selected.csv`);
  });
});
