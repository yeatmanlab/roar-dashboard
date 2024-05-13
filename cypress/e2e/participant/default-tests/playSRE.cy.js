import { playSRE } from '../../../support/helper-functions/roar-sre/sreHelpers';

const administration = Cypress.env('testRoarAppsAdministration');
const language = 'en';

describe('ROAR - Sentence Play Through', () => {
  it('Plays SRE', () => {
    if (cy.task('isCurrentVersion')) {
      cy.log('Detected most recent version of the app; skipping test.');
    } else {
      cy.log('Detected new version of the app; running test.');
      playSRE(administration, language);
    }
  });
});
