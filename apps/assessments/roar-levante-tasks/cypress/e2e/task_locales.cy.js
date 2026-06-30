const LOCALES = ['de-DE', 'es-CO', 'es-AR'];

const TASKS = [
  'intro',
  'egma-math',
  'matrix-reasoning',
  'mental-rotation',
  'hearts-and-flowers',
  'memory-game',
  'same-different-selection',
  'trog',
  'vocab',
  'theory-of-mind',
];

function visitTaskWithLocaleAndEnterFullscreen(task, lng) {
  cy.visit(`http://localhost:8000/?task=${task}&lng=${lng}`);
  // A full boot in CI (Firebase anonymous sign-in + GCS corpus/translation/asset fetches) routinely
  // takes much longer than Cypress's ~4s default. The dedicated per-task specs use generous timeouts
  // for the same reason (e.g. intro.cy.js waits 600000ms); mirror that here.
  cy.get('button.primary', { timeout: 60000 }).should('be.visible').first().realClick();
}

describe('tasks load in non-English locales (fullscreen only)', () => {
  TASKS.forEach((task) => {
    describe(task, () => {
      LOCALES.forEach((lng) => {
        it(`lng=${lng}`, () => {
          visitTaskWithLocaleAndEnterFullscreen(task, lng);
        });
      });
    });
  });
});
