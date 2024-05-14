import { playVocabulary } from '../../../support/helper-functions/roar-vocab/vocabHelpers';
import { isCurrentVersion } from '../../../support/utils';

const app = '@bdelab/roar-vocab';
describe('ROAR - Written Vocabulary Play Through', () => {
  it('Plays Written Vocabulary', () => {
    isCurrentVersion(app).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playVocabulary();
      }
    });
  });
});
