import { playPA } from '../../../../support/helper-functions/roar-pa/paHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@roar-dashboard/roar-pa';
let isCurrentAppVersion;

// SKIPPED until #1827: assessment play-through tests need reevaluation after monorepo migration
describe.skip('Participant Assessment: ROAR Phoneme', () => {
  before(async () => {
    isCurrentAppVersion = await isCurrentVersion(app);
  });

  describe.skip('EN', () => {
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

  describe.skip('ES', () => {
    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playPA({
        language: 'es',
        auth: 'username',
        administration: Cypress.env('testSpanishRoarAppsAdministration'),
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
        administration: Cypress.env('testSpanishRoarAppsAdministration'),
      });
    });
  });
});
