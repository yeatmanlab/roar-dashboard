import { playARF } from '../../../../support/helper-functions/roam-apps/roamHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const administration = Cypress.env('testSpanishRoarAppsAdministration');
const language = 'es';
const task = 'fluency-arf-es';
const endText = 'Has terminado.';

const app = '@bdelab/roam-apps';

describe('Test playthrough of ROAM ARF-ES as a participant', () => {
  it('ROAM Playthrough Test', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playARF({
          administration: administration,
          language: language,
          task: task,
          endText: endText,
        });
      }
    });
  });
});
