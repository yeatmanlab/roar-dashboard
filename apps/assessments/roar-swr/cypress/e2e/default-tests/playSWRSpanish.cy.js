const startText = '¡Bienvenidos al mundo de Lexicalidad!';
const endText = '¡Finalmente';

const userMode = 'shortRandom';
const language = 'es';
const storyOption = 'grade-based';
const useParameterValidation = 'true';
const variantParams = `lng=${language}&userMode=${userMode}&storyOption=${storyOption}&useParameterValidation=${useParameterValidation}`;

describe('Testing play through of SWR as a participant', () => {
  it('ROAR-Single Word Recognition Play Through Test', () => {
    cy.playSWR({
      startText: startText,
      endText: endText,
      variantParams: variantParams,
      language: language,
    });
  });
});
