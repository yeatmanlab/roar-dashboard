import { playPA } from '../../../../support/helper-functions/roar-pa/paHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-pa';
let isCurrentAppVersion;

describe('Participant Assessment: ROAR Phoneme', () => {
  before(async () => {
    isCurrentAppVersion = await isCurrentVersion(app);
  });

  describe('EN', () => {
    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playPA({ auth: 'username' });
    });

    it('Completes assessment with Clever authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playPA({ auth: 'clever' });
    });
  });

  describe('ES', () => {
    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playPA({
        language: 'es',
        auth: 'username',
      });
    });

    it('Completes assessment with Clever authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playPA({
        language: 'es',
        auth: 'clever',
      });
    });
  });
});
