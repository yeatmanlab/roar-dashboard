import { playVocabulary } from '../../../../support/helper-functions/roar-vocab/vocabHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-vocab';
// SKIPPED until #1827: assessment play-through tests need reevaluation after monorepo migration
describe.skip('ROAR - Vocabulary Play Through', () => {
  it('Plays Vocabulary with a simulated high latency connection', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playVocabulary({ auth: 'username' });
      }
    });
  });
});
