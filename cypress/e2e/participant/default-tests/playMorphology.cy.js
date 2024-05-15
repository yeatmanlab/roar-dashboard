import { playMorphology } from '../../../support/helper-functions/roar-multichoice/multichoiceHelpers';
import { isCurrentVersion } from '../../../support/utils';

const app = '@bdelab/roar-multichoice';

describe('ROAR - Written Vocabulary Play Through', () => {
  it('Plays Written Vocabulary', () => {
    isCurrentVersion(app).then((currentVersion) => {
      cy.log(currentVersion);
      if (currentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playMorphology();
      }
    });
  });
});
