/**
 * Converts roam-apps' `computedScoreCallback` output (see
 * `tasks/shared/helpers/scores.js`) into the flat `ScoreEntry[]` shape the
 * backend's `writeTrial` accepts and upserts into `run_scores`.
 *
 * `computedScores` is domain-keyed at the top level (subtask name, or
 * `composite`), each value a flat object of fields — e.g.:
 *
 * ```
 * {
 *   addition:  { numCorrect, numIncorrect, numAttempted, rawScore, subPercentCorrect, skillsAssessed },
 *   composite: { numCorrect, numIncorrect, numAttempted, rawScore, incorrectSkills: { addition: '...', ... } },
 * }
 * ```
 *
 * This is a first-pass, generic flattening: every primitive field on every
 * domain becomes one ScoreEntry, named after the field as-is. It intentionally
 * does NOT decide which of these names should be surfaced in a report —
 * that's a `fluency.json` / `roam-alpaca.json` subscores decision, tracked
 * separately, and out of scope for wiring the write path. Until that's
 * decided, this emits everything so the full shape is visible in `run_scores`.
 *
 * `numCorrect`/`numIncorrect`/`numAttempted` are raw trial-count fields (`type:
 * 'raw'`); everything else (rawScore, subPercentCorrect, theta/roarScore,
 * gradeEstimate, supportLevel, skillsAssessed, incorrectSkills) is derived
 * (`type: 'computed'`).
 *
 * Some composite fields (fluency's `incorrectSkills`) are objects keyed by
 * sub-domain rather than primitives — e.g. `{ multiplication: '6x7, 8x9', division: '9/3' }`.
 * Each key of such an object becomes its own entry, named `${field}_${subKey}`,
 * rather than one JSON-blob entry, so per-operator skill lists stay individually
 * addressable.
 *
 * @param {Record<string, Record<string, unknown>> | null | undefined} computedScores
 * @returns {Array<{type: 'raw'|'computed', domain: string, name: string, value: string, assessmentStage: 'test'}>}
 */
export function toRoamAppsScoreEntries(computedScores) {
  if (!computedScores) return [];

  const RAW_FIELD_NAMES = new Set(['numCorrect', 'numIncorrect', 'numAttempted']);
  const entries = [];

  for (const [domain, fields] of Object.entries(computedScores)) {
    if (!fields || typeof fields !== 'object') continue;

    for (const [name, value] of Object.entries(fields)) {
      if (value === null || value === undefined || value === '') continue;

      if (typeof value === 'object') {
        for (const [subKey, subValue] of Object.entries(value)) {
          if (subValue === null || subValue === undefined || subValue === '') continue;
          entries.push({
            type: 'computed',
            domain,
            name: `${name}_${subKey}`,
            value: String(subValue),
            assessmentStage: 'test',
          });
        }
        continue;
      }

      entries.push({
        type: RAW_FIELD_NAMES.has(name) ? 'raw' : 'computed',
        domain,
        name,
        value: String(value),
        assessmentStage: 'test',
      });
    }
  }

  return entries;
}
