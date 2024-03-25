import { playSWR } from '../../../../support/helper-functions/roar-swr/swrHelpers.js';

const administration = Cypress.env('testSpanishRoarAppsAdministration');
const language = 'es';

describe('ROAR - Palabra Play Through', () => {
  it('Plays Word', () => {
    playSWR(administration, language);
  });
});
