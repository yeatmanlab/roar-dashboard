import { playVocabulary } from '../../../../support/helper-functions/roar-vocab/vocabHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-vocab';
let isCurrentAppVersion;

describe('Participant Assessment: ROAR Vocab', () => {
  before(async () => {
    isCurrentAppVersion = await isCurrentVersion(app);
  });

  describe('EN', () => {
    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playVocabulary({ auth: 'username' });
    });

    it('Completes assessment with Clever authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playVocabulary({ auth: 'clever' });
    });
  });
});
