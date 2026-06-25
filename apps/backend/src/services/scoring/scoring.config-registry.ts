import type { ScoringConfig } from './scoring.config-schema';
import { ScoringConfigSchema } from './scoring.config-schema';

import swrConfig from './configs/swr';
import swrEsConfig from './configs/swr-es';
import swrItConfig from './configs/swr-it';
import swrPtConfig from './configs/swr-pt';
import swrDeConfig from './configs/swr-de';
import sreConfig from './configs/sre';
import sreEsConfig from './configs/sre-es';
import paConfig from './configs/pa';
import letterConfig from './configs/letter';
import phonicsConfig from './configs/phonics';
import roamAlpacaConfig from './configs/roam-alpaca.json';
import fluencyConfig from './configs/fluency.json';

const RAW_CONFIGS = [
  swrConfig,
  swrEsConfig,
  swrItConfig,
  swrPtConfig,
  swrDeConfig,
  sreConfig,
  sreEsConfig,
  paConfig,
  letterConfig,
  phonicsConfig,
  roamAlpacaConfig,
  fluencyConfig,
];

/**
 * Validated scoring configs indexed by task slug.
 * Built eagerly at import time — validation errors surface immediately at startup.
 */
const configBySlug = new Map<string, ScoringConfig>();

for (const raw of RAW_CONFIGS) {
  const parsed = ScoringConfigSchema.parse(raw);
  for (const slug of parsed.taskSlugs) {
    if (configBySlug.has(slug)) {
      throw new Error(`Duplicate task slug "${slug}" across scoring config files`);
    }
    configBySlug.set(slug, parsed);
  }
}

/**
 * Get the scoring config for a task slug.
 *
 * @param taskSlug - The task slug (e.g., 'swr', 'pa', 'letter-es')
 * @returns The parsed scoring config, or undefined if the task is unknown
 */
export function getScoringConfig(taskSlug: string): ScoringConfig | undefined {
  return configBySlug.get(taskSlug);
}

/**
 * Get all registered task slugs. Useful for testing.
 */
export function getRegisteredSlugs(): string[] {
  return [...configBySlug.keys()];
}
