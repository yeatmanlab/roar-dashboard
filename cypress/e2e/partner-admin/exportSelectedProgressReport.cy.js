const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');

describe('The partner admin can select and export progress reports for a given administration.', () => {
  it('Selects an administration and views its progress report', () => {
    cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
    cy.navigateTo('/');
    cy.getAdministrationCard();
    cy.get('button').contains('Progress').first().click();

    // make a selection
    cy.get('.p-checkbox-box').first().click();

    cy.get('button').contains('Export Selected').click();
    cy.readFile(`${Cypress.env('cypressDownloads')}/roar-progress-selected.csv`);
  });
});
