import { playFluencyCALF } from '../../../../support/helper-functions/roam-fluency/fluencyHelpers';

const administration = Cypress.env('testSpanishRoarAppsAdministration');
const language = 'es';
const task = 'fluency-calf-es';
const endText = 'Has terminado.';
const continueText = 'continuar';

describe('Test playthrough of Fluency ARF ES as a participant', () => {
  it('Fluency Playthrough Test', () => {
    playFluencyCALF({
      administration: administration,
      language: language,
      task: task,
      endText: endText,
      continueText: continueText,
    });
  });
});
