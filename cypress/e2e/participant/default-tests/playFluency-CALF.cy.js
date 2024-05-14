import { playFluencyCALF } from '../../../support/helper-functions/roam-fluency/fluencyHelpers';

describe('Test playthrough of Fluency as a participant', () => {
  it('Fluency Playthrough Test', () => {
    if (cy.task('isCurrentVersion')) {
      cy.log('Detected most recent version of the app; skipping test.');
    } else {
      cy.log('Detected new version of the app; running test.');
      playFluencyCALF();
    }
  });
});
