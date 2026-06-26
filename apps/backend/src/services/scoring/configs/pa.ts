import {
  PA_SCORE_NAMES,
  PA_SCORE_DOMAINS,
  PA_TASK_ID,
  PA_SUBSCORE_DEFS,
} from '@roar-platform/assessment-schema/roar-pa';

export default {
  taskSlugs: [PA_TASK_ID],
  scoreFields: {
    percentile: [
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: PA_SCORE_NAMES.PERCENTILE },
            { gradeGte: 6, value: PA_SCORE_NAMES.PERCENTILE_SPR },
          ],
        },
      },
    ],
    percentileDisplay: [
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: PA_SCORE_NAMES.PERCENTILE },
            { gradeGte: 6, value: PA_SCORE_NAMES.PERCENTILE_STRING_SPR },
          ],
        },
      },
    ],
    standardScore: [
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: PA_SCORE_NAMES.STANDARD_SCORE },
            { gradeGte: 6, value: PA_SCORE_NAMES.STANDARD_SCORE_SPR },
          ],
        },
      },
    ],
    standardScoreDisplay: [
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: PA_SCORE_NAMES.STANDARD_SCORE },
            { gradeGte: 6, value: PA_SCORE_NAMES.STANDARD_SCORE_STRING_SPR },
          ],
        },
      },
    ],
    rawScore: [{ minVersion: 0, fieldName: PA_SCORE_NAMES.RAW_SCORE }],
  },
  classification: {
    type: 'percentile-then-rawscore',
    percentileCutoffs: [
      { minVersion: 4, cutoffs: { achieved: 40, developing: 20 } },
      { minVersion: 0, cutoffs: { achieved: 50, developing: 25 } },
    ],
    rawScoreThresholds: [{ minVersion: 0, thresholds: { above: 55, some: 45 } }],
  },
  // Ordered subscore-table columns (replaces the old record-shaped block).
  // FSM/LSM/DEL are the per-subtask sub-skill columns surfaced by the
  // individual-student-report; the `total` aggregate (subskill:false) and the
  // computed `skillsToWorkOn` column are task-subscores-table-only. Every
  // run_scores.name comes from @roar-platform/assessment-schema (verified).
  // PA emits GENERIC score names (numCorrect/numAttempted/percentCorrect) under
  // per-subtask domains (FSM/LSM/DEL) and the composite domain, so each column
  // carries a `domain` that disambiguates the lookup. FSM/LSM/DEL are the
  // sub-skill breakdown (also surfaced by the individual-student-report); the
  // composite `total` (subskill:false) and computed skillsToWorkOn are
  // task-subscores-table-only. All names/domains come from assessment-schema.
  subscores: [
    {
      kind: 'itemLevel',
      key: 'FSM',
      label: PA_SUBSCORE_DEFS.FSM.label,
      domain: PA_SUBSCORE_DEFS.FSM.domain,
      correctName: PA_SUBSCORE_DEFS.FSM.correctName,
      attemptedName: PA_SUBSCORE_DEFS.FSM.attemptedName,
      percentCorrectName: PA_SUBSCORE_DEFS.FSM.percentCorrectName,
    },
    {
      kind: 'itemLevel',
      key: 'LSM',
      label: PA_SUBSCORE_DEFS.LSM.label,
      domain: PA_SUBSCORE_DEFS.LSM.domain,
      correctName: PA_SUBSCORE_DEFS.LSM.correctName,
      attemptedName: PA_SUBSCORE_DEFS.LSM.attemptedName,
      percentCorrectName: PA_SUBSCORE_DEFS.LSM.percentCorrectName,
    },
    {
      kind: 'itemLevel',
      key: 'DEL',
      label: PA_SUBSCORE_DEFS.DEL.label,
      domain: PA_SUBSCORE_DEFS.DEL.domain,
      correctName: PA_SUBSCORE_DEFS.DEL.correctName,
      attemptedName: PA_SUBSCORE_DEFS.DEL.attemptedName,
      percentCorrectName: PA_SUBSCORE_DEFS.DEL.percentCorrectName,
    },
    {
      // Composite total (numCorrect / numAttempted under the composite domain).
      // subskill:false keeps it out of the individual-student-report breakdown.
      kind: 'itemLevel',
      key: 'total',
      label: 'Total',
      domain: PA_SCORE_DOMAINS.COMPOSITE,
      correctName: PA_SCORE_NAMES.NUM_CORRECT,
      attemptedName: PA_SCORE_NAMES.NUM_ATTEMPTED,
      subskill: false,
    },
    { kind: 'paSkillsToWorkOn', key: 'skillsToWorkOn', label: 'Skills To Work On' },
  ],
} as const;
