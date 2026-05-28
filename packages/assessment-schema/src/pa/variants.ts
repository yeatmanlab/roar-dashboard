import { PA_SCORING_VERSION, PA_SCORE_KIND } from './config.js';

/**
 * Canonical PA variant kinds. Each entry must be representable in
 * `task_variants.params` and consumed by the PA assessment runtime.
 * Add an entry here when introducing a new scoring approach.
 */
export const PA_VARIANT_KINDS = {
  FIXED: {
    scoringVersion: PA_SCORING_VERSION.V3_FIXED,
    scoreKind: PA_SCORE_KIND.FIXED,
    isAdaptive: false,
    itemSelect: 'fixed',
    label: 'Fixed',
    description: 'Fixed-form assessment',
  },
  ADAPTIVE: {
    scoringVersion: PA_SCORING_VERSION.V4_ADAPTIVE,
    scoreKind: PA_SCORE_KIND.ADAPTIVE,
    isAdaptive: true,
    itemSelect: 'mfi',
    label: 'Adaptive',
    description: 'Adaptive (IRT-based) assessment',
  },
} as const;

/**
 * Languages PA ships variants for. The seed script produces a row per
 * (language, variant kind). Add an entry here when PA's content is
 * localized into a new language.
 */
export const PA_LANGUAGES = {
  en: { code: 'en', label: 'English' },
} as const satisfies Record<string, { code: string; label: string }>;
