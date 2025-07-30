import { playWrittenVocabulary } from '../../../../support/helper-functions/roar-multichoice/multichoiceHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-multichoice';
let isCurrentAppVersion;

describe('Participant Assessment: ROAR CVA', () => {
  before(async () => {
    isCurrentAppVersion = await isCurrentVersion(app);
  });

  describe('EN', () => {
    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playWrittenVocabulary({ auth: 'username' });
    });

    it('Completes assessment with Clever authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playWrittenVocabulary({ auth: 'clever' });
    });
  });
});
