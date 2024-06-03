export const generatedSpecTemplate = (adminName) => {
  return `
  const timeout = Cypress.env('timeout');
  describe('Testing individual synced administration', () => {
    it('Tests a synced administration', () => {
      cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
      cy.visit('/', { timeout: 2 * timeout });
      cy.selectAdministration('${adminName}');
      cy.log(\`Found administration: ${adminName}\`);
    });
  });
  `;
};
