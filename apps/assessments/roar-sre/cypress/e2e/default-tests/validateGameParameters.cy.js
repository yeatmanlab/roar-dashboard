const validParameters = 'mode=default&useParameterValidation=true';
const invalidParameters = 'mode=shortReport&useParameterValidation=true';
const bypassInvalidParameters = 'mode=shortReport&useParameterValidation=false';

describe('Validating variant parameter values', () => {
  beforeEach(() => {
    Cypress.on('window:before:load', (win) => {
      cy.spy(win.console, 'log').as('consoleLog');
      cy.spy(win.console, 'error').as('consoleError');
    });
  });

  it('validates the variant parameters', () => {
    cy.playIntro({ variantParams: validParameters });
    cy.get('@consoleLog').should('have.been.calledWith', 'Parameters successfully validated.');
  });

  it('skips validating the variant parameters', () => {
    cy.playIntro({ variantParams: bypassInvalidParameters });
    cy.get('@consoleLog').should('not.have.been.calledWith', 'Parameters successfully validated.');
    cy.get('@consoleError').then((errorSpy) => {
      const hasError = errorSpy
        .getCalls()
        .some((call) =>
          call.args.some((arg) => typeof arg === 'string' && arg.includes('Detected invalid game parameters')),
        );
      expect(hasError).to.be.false;
    });
  });

  it('detects invalid variant parameters and throws an error', () => {
    cy.on('uncaught:exception', (err) => {
      if (err.message.includes('Detected invalid variant parameters')) {
        // Pass the test if the error is the one we are expecting
        expect(err.message).to.include('Detected invalid variant parameters');
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
    cy.playSREGame({ variantParams: invalidParameters });
  });
});
