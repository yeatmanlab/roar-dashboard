import { COMPOSITE_DOMAIN } from '../constants/common-domains.js';
import { AssessmentStage } from '../enums/assessment-stage.enum.js';

/**
 * Canonical run_scores.domain strings for roav-apps score entries.
 *
 * Both roav-mp and roav-rvp write into the single `composite` domain. The practice/test
 * split is carried by run_scores.assessment_stage — not by separate domains — which
 * reconstructs the legacy `scores.raw.composite.{practice,test}` structure.
 */
export const ROAV_APPS_SCORE_DOMAINS = {
  COMPOSITE: COMPOSITE_DOMAIN,
} as const;

export type RoavAppsScoreDomain = (typeof ROAV_APPS_SCORE_DOMAINS)[keyof typeof ROAV_APPS_SCORE_DOMAINS];

/**
 * Stage-partition keys nested under the `composite` domain in the scoring callback's
 * `computed` object (i.e. `computed.composite.{practice,test}`). Each key selects a
 * run_scores.assessment_stage (via `domainToAssessmentStage`) while all entries share the
 * `composite` domain. `PRACTICE` aligns with the shared PRACTICE_DOMAIN so the stage util
 * resolves it to AssessmentStage.PRACTICE; any other key (TEST) resolves to TEST.
 */
export const ROAV_APPS_STAGE_KEYS = {
  PRACTICE: AssessmentStage.PRACTICE,
  TEST: AssessmentStage.TEST,
} as const;

export type RoavAppsStageKey = (typeof ROAV_APPS_STAGE_KEYS)[keyof typeof ROAV_APPS_STAGE_KEYS];
