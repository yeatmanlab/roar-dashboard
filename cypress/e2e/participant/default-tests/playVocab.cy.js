import { playVocabulary } from '../../../support/helper-functions/roar-vocab/vocabHelpers';
import { isCurrentVersion } from '../../../support/utils';

const app = '@bdelab/roar-vocab';
describe('ROAR - Vocabulary Play Through', () => {
  it('Plays Vocabulary with username auth', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playVocabulary({ auth: 'username' });
      }
    });
  });
  it('Plays Vocabulary with Clever auth', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playVocabulary({ auth: 'clever' });
      }
    });
  });
});
