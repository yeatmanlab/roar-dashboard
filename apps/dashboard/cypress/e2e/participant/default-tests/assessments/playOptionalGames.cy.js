import { optionalGames } from '../../../../fixtures/participant/optionalGamesList.js';
import { isCurrentVersion } from '../../../../support/utils';

optionalGames.forEach((game) => {
  let isCurrentAppVersion;

  describe(`Optional Participant Assessment: ${game.name}`, () => {
    before(async () => {
      isCurrentAppVersion = await isCurrentVersion(game.app);
    });

    describe('EN', () => {
      const administration = Cypress.env('testOptionalRoarAppsAdministration');
      const language = 'en';
      const optional = true;

      it(`Completes assessment with username/password authentication`, () => {
        if (isCurrentAppVersion) {
          cy.log(`Did not detect a new version of ${game.app}, skipping test.`);
          return;
        }

        game.testSpec({ administration, language, optional });
      });
    });
  });
});
