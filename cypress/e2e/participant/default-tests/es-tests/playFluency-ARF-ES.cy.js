import { playFluencyARF } from '../../../../support/helper-functions/roam-fluency/fluencyHelpers';

const administration = Cypress.env('testSpanishRoarAppsAdministration');
const language = 'es';
const task = 'fluency-arf-es';
const endText = 'Has terminado.';

describe('Test playthrough of Fluency ARF ES as a participant', () => {
  it('Fluency Playthrough Test', () => {
    playFluencyARF({
      administration: administration,
      language: language,
      task: task,
      endText: endText,
    });
  });
});
