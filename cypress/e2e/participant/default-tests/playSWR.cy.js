import { playSWR } from '../../../support/helper-functions/roar-swr/swrHelpers.js';

describe('ROAR - Word Play Through', () => {
  it('Plays Word', () => {
    if (cy.task('isCurrentVersion')) {
      cy.log('Detected most recent version of the app; skipping test.');
    } else {
      cy.log('Detected new version of the app; running test.');
      playSWR();
    }
  });
});
