import { playARF } from '../../../../support/helper-functions/roam-apps/roamHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roam-apps';
let isCurrentAppVersion;

describe('Participant Assessment: ROAM ARF', () => {
  before(async () => {
    isCurrentAppVersion = await isCurrentVersion(app);
  });

  describe('EN', () => {
    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playARF({ auth: 'username' });
    });

    it('Completes assessment with Clever authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playARF({ auth: 'clever' });
    });
  });

  describe('ES', () => {
    const administration = Cypress.env('testSpanishRoarAppsAdministration');
    const language = 'es';
    const task = 'fluency-arf-es';
    const endText = 'Has terminado.';

    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playARF({
        administration,
        language,
        task,
        endText,
      });
    });
  });
});
