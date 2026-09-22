import ScoreDistributionOverview from './ScoreDistributionOverview.vue';
import { SCORE_SUPPORT_SKILL_LEVELS } from '@/constants/scores';

/**
 * Component-level behavior only: which sections and rows render, and which task-name
 * fields are read. The count arithmetic these charts display lives in
 * `mapSupportLevelCounts` / `aggregateSupportLevelRuns` and is covered directly in
 * `helpers/plotting.test.js` — the bars render to a canvas, so counts aren't
 * assertable from the DOM here.
 */

/** One task's entry as the score-overview endpoint returns it. */
const supportLevels = (below, some, above) => ({
  needsExtraSupport: { count: below },
  developingSkill: { count: some },
  achievedSkill: { count: above },
});

/** A client-side run backing the foundational-composite row. */
const compositeRun = (supportLevel) => ({ scores: { support_level: supportLevel } });

const mountChart = (props = {}) => {
  cy.mount(ScoreDistributionOverview, {
    props: {
      taskIds: ['swr'],
      supportLevelsByTaskId: { swr: supportLevels(1, 1, 1) },
      compositeFoundationalRuns: null,
      tasksDictionary: {},
      ...props,
    },
  });
};

describe('<ScoreDistributionOverview />', () => {
  describe('task grouping', () => {
    it('splits tasks into foundational, Spanish, and comprehension sections', () => {
      mountChart({
        taskIds: ['swr', 'swr-es', 'morphology'],
        supportLevelsByTaskId: {
          swr: supportLevels(1, 1, 1),
          'swr-es': supportLevels(1, 1, 1),
          morphology: supportLevels(1, 1, 1),
        },
      });

      cy.contains('Foundational Literacy Skills').should('be.visible');
      cy.contains('Spanish Foundational Literacy Skills').should('be.visible');
      cy.contains('Comprehension Skills').should('be.visible');
    });

    it('omits the Spanish and comprehension sections when no such task is present', () => {
      mountChart({ taskIds: ['swr'] });

      cy.contains('Spanish Foundational Literacy Skills').should('not.exist');
      cy.contains('Comprehension Skills').should('not.exist');
    });

    it('renders a row per task without erroring when one is missing from the response', () => {
      // A task absent from the score-overview response must still render (as an empty
      // chart) rather than throwing — the endpoint only returns scored tasks.
      mountChart({
        taskIds: ['swr', 'sre'],
        supportLevelsByTaskId: { swr: supportLevels(1, 2, 3) },
      });

      cy.get('canvas').should('have.length.at.least', 2);
    });
  });

  describe('task labels', () => {
    it('uses the backend nameTechnical / nameSimple fields', () => {
      // Regression: this component arrived from main reading Firestore-era
      // `technicalName` / `publicName`, which the backend Task schema does not have,
      // so every row rendered a bare slug instead of a task name.
      mountChart({
        tasksDictionary: { swr: { nameTechnical: 'Single Word Recognition', nameSimple: 'Word' } },
      });

      cy.contains('Single Word Recognition').should('be.visible');
      cy.contains('Word').should('be.visible');
    });

    it('falls back to the task slug when the dictionary has no entry', () => {
      mountChart({ tasksDictionary: {} });

      cy.contains('swr').should('be.visible');
    });
  });

  describe('foundational composite row', () => {
    it('is hidden when no composite runs are supplied', () => {
      mountChart({ compositeFoundationalRuns: null });

      cy.contains('Foundational Skills Composite').should('not.exist');
    });

    it('renders for an array of runs at school/class/group scope', () => {
      mountChart({
        compositeFoundationalRuns: [
          compositeRun(SCORE_SUPPORT_SKILL_LEVELS.NEEDS_EXTRA_SUPPORT),
          compositeRun(SCORE_SUPPORT_SKILL_LEVELS.ACHIEVED_SKILL),
        ],
      });

      cy.contains('Foundational Skills Composite').should('be.visible');
    });

    it('renders for pre-aggregated totals at district scope', () => {
      // Both shapes are accepted without a scope prop; the helper distinguishes them.
      mountChart({
        compositeFoundationalRuns: { below: { total: 4 }, some: { total: 5 }, above: { total: 6 } },
      });

      cy.contains('Foundational Skills Composite').should('be.visible');
    });
  });
});
