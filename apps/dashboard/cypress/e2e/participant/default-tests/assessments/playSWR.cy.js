import { playSWR } from '../../../../support/helper-functions/roar-swr/swrHelpers.js';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-swr';
let isCurrentAppVersion;

describe('Participant Assessment: ROAR SWR', () => {
  before(async () => {
    isCurrentAppVersion = await isCurrentVersion(app);
  });

  describe('EN', () => {
    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playSWR({ auth: 'username' });
    });

    it('Completes assessment with Clever authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playSWR({ auth: 'clever' });
    });
  });

  describe('ES', () => {
    const administration = Cypress.env('testSpanishRoarAppsAdministration');
    const language = 'es';

    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playSWR({
        administration: administration,
        language: language,
      });
    });
  });
});
