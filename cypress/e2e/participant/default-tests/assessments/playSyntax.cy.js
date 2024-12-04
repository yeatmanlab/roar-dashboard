import { playSyntax } from '../../../../support/helper-functions/roar-syntax/syntaxHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = 'core-tasks';
const administration = 'Cypress Test Roar Syntax';
let isCurrentAppVersion;

describe('Participant Assessment: ROAR Syntax', () => {
  before(async () => {
    isCurrentAppVersion = await isCurrentVersion(app);
  });

  describe('EN', () => {
    it('Completes assessment with username/password authentication', () => {
      if (isCurrentAppVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
        return;
      }

      playSyntax({ administration: administration, auth: 'username' });
    });
  });
});
