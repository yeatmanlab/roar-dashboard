import { playSWR } from '../../../../support/helper-functions/roar-swr/swrHelpers.js';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-swr';
let isCurrentAppVersion;

// SKIPPED until #1827: assessment play-through tests need reevaluation after monorepo migration
describe.skip('Participant Assessment: ROAR SWR', () => {
  before(async () => {
    isCurrentAppVersion = await isCurrentVersion(app);
  });

  describe.skip('EN', () => {
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

  describe.skip('ES', () => {
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
