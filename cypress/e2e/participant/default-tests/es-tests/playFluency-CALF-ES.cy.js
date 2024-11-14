import { playFluencyCALF } from '../../../../support/helper-functions/roam-fluency/fluencyHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const administration = Cypress.env('testSpanishRoarAppsAdministration');
const language = 'es';
const task = 'fluency-calf-es';
const endText = 'Has terminado.';
const continueText = 'continuar';

const app = '@bdelab/roam-fluency';

describe('Test playthrough of Fluency ARF ES as a participant', () => {
  it('Fluency Playthrough Test', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playFluencyCALF({
          administration: administration,
          language: language,
          task: task,
          endText: endText,
          continueText: continueText,
        });
      }
    });
  });
});
