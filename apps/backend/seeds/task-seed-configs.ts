/**
 * Task seed configuration types and registry.
 *
 * Types are defined here so per-assessment config files can import them without
 * circular dependencies. The registry re-exports all configs keyed by CLI name.
 */

import { paConfig } from './configs/roar-pa.config';
import { swrConfig } from './configs/roar-swr.config';
import { sreConfig } from './configs/roar-sre.config';
import { letterConfig } from './configs/roar-letter.config';
import { multichoiceConfig } from './configs/roar-multichoice.config';
import { surveyConfig } from './configs/roar-survey.config';
import { levanteConfig } from './configs/roar-levante-tasks.config';
import { readaloudConfig } from './configs/roar-readaloud.config';
import { roavAppsConfig } from './configs/roav-apps.config';
import { roavRanConfig } from './configs/roav-ran.config';
import { roamAppsConfig } from './configs/roam-apps.config';

// ─── Types ───────────────────────────────────────────────────────────────────

export type VariantDef = {
  variantName: string;
  params: Record<string, unknown>;
};

/**
 * Configuration for seeding a single assessment's tasks and variants.
 *
 * Each assessment provides a config that defines its task metadata, parameter validation,
 * and (for multi-task assessments) the logic to route a variant to the correct task.
 *
 * The variant parameters come from a `taskVariantParameters.json` file whose entries
 * match the `gameParams` the assessment's `serve.js` passes to the task runner.
 *
 * @see {@link ../task-seed.ts} for the unified runner that consumes these configs.
 */
export type TaskSeedConfig = {
  /** Map of taskId → task metadata for DB insertion. */
  tasks: Record<
    string,
    {
      name: string;
      nameSimple: string;
      nameTechnical: string;

      /**
       * Participant-facing blurb shown on the task tile, e.g. "Words will flash quickly
       * on the screen. Decide if they are real or made up."
       */
      description?: string;

      /**
       * Tile artwork for the participant's assessment list.
       *
       * Optional, but a task without one falls through to a hardcoded fallback in
       * `GameTabs.vue` that no CSP directive allows, so the tile renders a broken
       * image. Host must be allowlisted in `img-src` — `raw.githubusercontent.com/yeatmanlab/`
       * (where the `roar-assets` artwork lives) and the `storage.googleapis.com/roar-*`
       * buckets already are.
       */
      image?: string;

      /**
       * Instructional video played in place of the tile artwork when present.
       *
       * Host must be allowlisted in `media-src`, which covers the
       * `storage.googleapis.com/roar-*` buckets.
       */
      tutorialVideo?: string;
    }
  >;

  /**
   * Allowed parameter keys. If set, unknown keys are rejected.
   * Derived from the assessment's serve.js gameParams.
   */
  allowedParamKeys?: Set<string>;

  /**
   * Custom validation per variant. Throws on invalid input.
   *
   * @returns `void` to accept the variant, `false` to skip it gracefully (e.g., for
   *          unsupported languages that shouldn't fail the seed run).
   */
  validateVariant?: (loc: string, params: Record<string, unknown>) => void | boolean;

  /**
   * For multi-task assessments, resolves which taskId a variant belongs to from its params.
   *
   * Single-task configs omit this — all variants belong to the one task in `tasks`.
   * Multi-task configs (SWR, SRE, Letter, Multichoice, ROAV, Levante) use a routing
   * param (`lng`, `task`, `taskName`) to determine the target task.
   */
  resolveTaskId?: (params: Record<string, unknown>) => string;

  /**
   * `variantName` of the variant to assign to the dev fixture's administration, making
   * this assessment launchable from the dashboard on a greenfield setup.
   *
   * Naming it here rather than taking the first entry of `taskVariantParameters.json`
   * keeps the choice deterministic and platform-owned: that file is authored per
   * assessment and its order can change in an unrelated PR.
   *
   * Configs without this field seed their tasks and variants as before but are not
   * assigned to any administration. Must match a `variantName` in the assessment's
   * parameters file, or the assignment step logs and skips it.
   */
  defaultVariant?: string;
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const TASK_SEED_CONFIGS: Record<string, TaskSeedConfig> = {
  'roar-pa': paConfig,
  'roar-swr': swrConfig,
  'roar-sre': sreConfig,
  'roar-letter': letterConfig,
  'roar-multichoice': multichoiceConfig,
  'roar-survey': surveyConfig,
  'roar-levante-tasks': levanteConfig,
  'roar-readaloud': readaloudConfig,
  'roav-apps': roavAppsConfig,
  'roav-ran': roavRanConfig,
  'roam-apps': roamAppsConfig,
};
