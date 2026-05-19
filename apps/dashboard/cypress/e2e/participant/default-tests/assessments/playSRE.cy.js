import { playSRE } from '../../../../support/helper-functions/roar-sre/sreHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-sre';
let isCurrentAppVersion;

describe.skip('Participant Assessment: ROAR SRE', () => {
  before(async () => {
    isCurrentAppVersion = await isCurrentVersion(app);
  });

  describe.skip('EN', () => {
    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playSRE({ auth: 'username' });
    });

    it('Completes assessment with Clever authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playSRE({ auth: 'clever' });
    });
  });

  describe.skip('ES', () => {
    const administration = Cypress.env('testSpanishRoarAppsAdministration');
    const language = 'es';

    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playSRE({
        administration: administration,
        language: language,
      });
    });
  });
});
