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
  tasks: Record<string, { name: string; nameSimple: string; nameTechnical: string }>;

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
};
