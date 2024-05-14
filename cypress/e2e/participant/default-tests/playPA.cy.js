import { playPA } from '../../../support/helper-functions/roar-pa/paHelpers';

describe('Testing playthrough of ROAR-Phoneme as a participant', () => {
  it(`ROAR-Phoneme Playthrough Test`, () => {
    if (cy.task('isCurrentVersion')) {
      cy.log('Detected most recent version of the app; skipping test.');
    } else {
      cy.log('Detected new version of the app; running test.');
      playPA();
    }
  });
});
