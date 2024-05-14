import { playVocabulary } from '../../../support/helper-functions/roar-vocab/vocabHelpers';

describe('ROAR - Written Vocabulary Play Through', () => {
  it('Plays Written Vocabulary', () => {
    if (cy.task('isCurrentVersion')) {
      cy.log('Detected most recent version of the app; skipping test.');
    } else {
      cy.log('Detected new version of the app; running test.');
      playVocabulary();
    }
  });
});
