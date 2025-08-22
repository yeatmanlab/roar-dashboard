import { playLetter } from '../../../../support/helper-functions/roar-letter/letterHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-letter';
let isCurrentAppVersion;

describe('Participant Assessment: ROAR Letter', () => {
  before(async () => {
    isCurrentAppVersion = await isCurrentVersion(app);
  });

  describe('EN', () => {
    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playLetter({ auth: 'username' });
    });

    it('Completes assessment with Clever authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playLetter({ auth: 'clever' });
    });
  });

  describe('ES', () => {
    const administration = Cypress.env('testSpanishRoarAppsAdministration');
    const language = 'es';
    const gameCompleteText = '¡Has terminado! ¡Gracias por ayudarme a encontrar esas letras!';

    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playLetter({
        administration: administration,
        language: language,
        gameCompleteText: gameCompleteText,
      });
    });
  });
});
