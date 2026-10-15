import { testAfc } from './helpers.js';

const TOM_url = 'http://localhost:8000/?task=theory-of-mind';

// Skipped 2026-10-15. The failure is in the task's content data, not in the task or this spec: the
// dev item bank was re-uploaded on 2026-10-14 without a prompt translation that the Theory of Mind
// corpus still references. `validateLayoutConfig` requires a prompt translation for every trial and
// `buildTOMTimeline` throws on any validation error, so the timeline is never built and the task
// never renders the OK gate this spec waits for. Production content is unaffected, so there is no
// participant impact to chase here.
//
// Remove this `.skip` once the item bank and the corpus agree again — the data fix is upstream, so
// nothing else in this repo has to change for it, but the skip does have to be taken out by hand.
// The un-skip is an acceptance criterion on the ticket.
//
// See yeatmanlab/roar-project-management#2410 for the affected item, the object versions, and the
// remedy.
describe.skip('test theory of mind', () => {
  it('visits theory of mind and plays game', () => {
    cy.visit(TOM_url);
    testAfc('class', '.image');
  });
});
