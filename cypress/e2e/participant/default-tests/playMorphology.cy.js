import { playMorphology } from '../../../support/helper-functions/roar-multichoice/multichoiceHelpers';

describe('ROAR - Written Vocabulary Play Through', () => {
  it('Plays Written Vocabulary', () => {
    if (cy.task('isCurrentVersion')) {
      cy.log('Detected most recent version of the app; skipping test.');
    } else {
      cy.log('Detected new version of the app; running test.');
      playMorphology();
    }
  });
});
