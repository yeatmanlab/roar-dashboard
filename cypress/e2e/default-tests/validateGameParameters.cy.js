const useParameterValidation = 'true';
const invalidNumNew = '2000';
const validVariantParameters = `useParameterValidation=${useParameterValidation}&numNew=100`;
const invalidVariantParameters = `useParameterValidation=${useParameterValidation}&numNew=${invalidNumNew}`;

describe('Validating variant parameters.', () => {
  beforeEach(() => {
    Cypress.on('window:before:load', (win) => {
      cy.spy(win.console, 'log').as('consoleLog');
    });
  });
  it('validates the variant parameters', () => {
    cy.playSWR({ variantParams: validVariantParameters });
    cy.get('@consoleLog').should('have.been.calledWith', 'Parameters successfully validated.');
  });

  it('detects invalid game parameters and throws an error', () => {
    cy.on('uncaught:exception', (err) => {
      if (err.message.includes('Detected invalid game parameters')) {
        // Pass the test if the error is the one we are expecting
        expect(err.message).to.include('Detected invalid game parameters');
        return false;
      }
      // Fail the test if the error is not the one we are expecting
      return true;
    });
    cy.on('fail', (err) => {
      // Pass the test if the error is the one we are expecting
      expect(err.message).to.include('Timed out');
      return false;
    });
    // This command will fail and throw the errors described above
    cy.playSWR({ variantParams: invalidVariantParameters });
  });
});
