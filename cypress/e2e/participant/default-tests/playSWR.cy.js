import { playSWR } from '../../../support/helper-functions/roar-swr/swrHelpers.js';

describe('ROAR - Word Play Through', () => {
  it('Plays Word', () => {
    playSWR(Cypress.env('testRoarAppsAdministration'));
  });
});
