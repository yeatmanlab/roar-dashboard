import { playLetter } from '../../../support/helper-functions/roar-letter/letterHelpers';

describe('ROAR - Letra Play Through', () => {
  it('Plays Letra', () => {
    if (cy.task('isCurrentVersion')) {
      cy.log('Detected most recent version of the app; skipping test.');
    } else {
      cy.log('Detected new version of the app; running test.');
      playLetter();
    }
  });
});
