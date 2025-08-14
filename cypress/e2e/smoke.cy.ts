describe('Smoke Test', () => {
  it('loads the signin page', () => {
    cy.visit('http://localhost:5173/signin');
    cy.contains('Sign In').should('be.visible');
    cy.get('input').should('have.length', 2);
    cy.get('button').should('exist');
  });
});
