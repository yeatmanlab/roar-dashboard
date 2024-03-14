import { playSRE } from '../../../support/helper-functions/roar-sre/sreHelpers';

describe('ROAR - Sentence Play Through', () => {
  it('Plays SRE', () => {
    playSRE(Cypress.env('testRoarAppsAdministration'));
  });
});
