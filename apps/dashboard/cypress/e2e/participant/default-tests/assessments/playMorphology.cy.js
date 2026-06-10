import { playMorphology } from '../../../../support/helper-functions/roar-multichoice/multichoiceHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-multichoice';
let isCurrentAppVersion;

// SKIPPED until #1827: assessment play-through tests need reevaluation after monorepo migration
describe.skip('Participant Assessment: ROAR Morphology', () => {
  before(async () => {
    isCurrentAppVersion = await isCurrentVersion(app);
  });

  describe.skip('EN', () => {
    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playMorphology({ auth: 'username' });
    });

    it('Completes assessment with Clever authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playMorphology({ auth: 'clever' });
    });
  });
});
