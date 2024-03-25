import { playSRE } from '../../../support/helper-functions/roar-sre/sreHelpers';

const administration = Cypress.env('testRoarAppsAdministration');
const language = 'en';

describe('ROAR - Sentence Play Through', () => {
  it('Plays SRE', () => {
    playSRE(administration, language);
  });
});
