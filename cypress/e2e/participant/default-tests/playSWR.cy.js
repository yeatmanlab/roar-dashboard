import { playSWR } from '../../../support/helper-functions/roar-swr/swrHelpers.js';

const administration = Cypress.env('testRoarAppsAdministration');
const language = 'en';

describe('ROAR - Word Play Through', () => {
  it('Plays Word', () => {
    playSWR(administration, language);
  });
});
