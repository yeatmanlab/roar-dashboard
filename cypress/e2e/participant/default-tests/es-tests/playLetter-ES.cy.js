import { playLetter } from '../../../../support/helper-functions/roar-letter/letterHelpers';

const administration = Cypress.env('testSpanishRoarAppsAdministration');
const language = 'es';
const gameCompleteText = '¡Has terminado! ¡Gracias por ayudarme a encontrar esas letras!';

describe('ROAR - Letra Play Through', () => {
  it('Plays Letra', () => {
    playLetter(administration, language, gameCompleteText);
  });
});
