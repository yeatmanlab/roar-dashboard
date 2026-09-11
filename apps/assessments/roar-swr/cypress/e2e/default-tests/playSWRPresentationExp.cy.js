const userMode = 'presentationExp';
const language = 'en';
const useParameterValidation = 'true';
const variantParams = `userMode=${userMode}&lng=${language}&useParameterValidation=${useParameterValidation}`;

describe('Testing play through of SWR as a participant', () => {
  it('ROAR-Single Word Recognition Play Through Test', () => {
    cy.playSWR({
      variantParams: variantParams,
    });
  });
});
