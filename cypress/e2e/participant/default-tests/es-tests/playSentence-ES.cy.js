import { playSRE } from '../../../../support/helper-functions/roar-sre/sreHelpers';

const administration = Cypress.env('testSpanishRoarAppsAdministration');
const language = 'es';

describe('ROAR - Sentence Play Through', () => {
  it('Plays SRE', () => {
    playSRE(administration, language);
  });
});
