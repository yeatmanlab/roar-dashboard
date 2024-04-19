import { playSWR } from '../../../../support/helper-functions/roar-swr/swrHelpers.js';

const administration = Cypress.env('testRoarAppsAdministration');
const language = 'en';

describe('ROAR - Word Play Through in a simulated 2G network', () => {
  it('Plays Word', () => {
    playSWR(administration, language);
  });
});
