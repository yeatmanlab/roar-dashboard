/**
 * Subscore-table column registry.
 *
 * Declares the per-task column metadata + value-source mapping for the
 * task-subscores endpoint (`GET .../reports/scores/tasks/:taskId`).
 *
 * The dashboard previously hard-coded these column lists in
 * `apps/dashboard/src/components/reports/SubscoreTable.vue` — the registry
 * is a server-side single source of truth so the frontend can render any
 * task's subscore table from `subscoreColumns` metadata returned by the
 * API.
 *
 * ### Column value modes
 *
 * - **`itemLevel`** — combines two `run_scores.name` values
 *   (`correctName` + `attemptedName`) into a `"correct/attempted"` string.
 *   `percentCorrectName`, when defined, is used for numeric sort/filter.
 * - **`number`** — single `run_scores.name` returning a number. Optional
 *   `round` flag rounds to integer for display (used by % values).
 * - **`stringPassthrough`** — single `run_scores.name` whose value is
 *   surfaced as-is (used for comma-separated lists like `incorrectLetters`
 *   or `incorrectSkills`).
 * - **`paSkillsToWorkOn`** — special PA-only computed column. Aggregates
 *   the FSM/LSM/DEL subscores against `PA_SKILL_THRESHOLD` (or the legacy
 *   `roarScore` fallback) and emits a comma-separated list of subtasks
 *   the student should work on. Computed by `computeSkillsToWorkOn`.
 *
 * ### Naming conventions
 *
 * `correctName`, `attemptedName`, `percentCorrectName`, and `name` are
 * matched case-sensitively against `app_assessment_fdw.run_scores.name`.
 * The conventions for each task family below are best-guesses pending
 * verification against actual assessment-side data — adjustments are
 * config-only and do not require code changes.
 */

import type { Column } from 'drizzle-orm';

// --- Column type definitions (discriminated union) ---

export interface TaskSubscoreColumnBase {
  /** Stable column key surfaced to the API. */
  key: string;
  /** Human-readable label shown in the table header. */
  label: string;
}

export interface ItemLevelColumn extends TaskSubscoreColumnBase {
  kind: 'itemLevel';
  correctName: string;
  attemptedName: string;
  /** Optional pre-computed percent-correct field used for numeric sort/filter. */
  percentCorrectName?: string;
}

export interface NumberColumn extends TaskSubscoreColumnBase {
  kind: 'number';
  name: string;
  /** Round to integer when emitting (used for percentage / score displays). */
  round?: boolean;
}

export interface StringPassthroughColumn extends TaskSubscoreColumnBase {
  kind: 'stringPassthrough';
  name: string;
}

export interface PaSkillsToWorkOnColumn extends TaskSubscoreColumnBase {
  kind: 'paSkillsToWorkOn';
}

export type TaskSubscoreColumnDef = ItemLevelColumn | NumberColumn | StringPassthroughColumn | PaSkillsToWorkOnColumn;

// --- Per-task column registry ---

/**
 * Column registry keyed by task slug. A slug present here has a registered
 * subscore table; tasks without an entry return 400 from the task-subscores
 * endpoint.
 *
 * The two slugs whose conventions are verified end-to-end against the
 * existing `subscores` block in scoring config (`pa.json`, `phonics.json`)
 * are PA and phonics. Letter, fluency, and roam-alpaca columns are
 * declared with best-guess `run_scores.name` values that will be
 * reconciled in a config-only follow-up once data lands — no schema
 * changes required when names get corrected.
 */
export const TASK_SUBSCORE_TABLE: Record<string, TaskSubscoreColumnDef[]> = {
  // ─────────── Phonics ───────────
  // 9 sub-skill domains + total percent. Mirrors the dashboard's
  // SubscoreTable.vue phonics column list (CVC, Digraph, Initial Blend,
  // Triple Blend, Final Blend, R-Controlled, R-Cluster, Silent E,
  // Vowel Team) plus a final % column.
  phonics: [
    {
      kind: 'itemLevel',
      key: 'cvc',
      label: 'CVC',
      correctName: 'cvcCorrect',
      attemptedName: 'cvcAttempted',
      percentCorrectName: 'cvcPercentCorrect',
    },
    {
      kind: 'itemLevel',
      key: 'digraph',
      label: 'Digraph',
      correctName: 'digraphCorrect',
      attemptedName: 'digraphAttempted',
      percentCorrectName: 'digraphPercentCorrect',
    },
    {
      kind: 'itemLevel',
      key: 'initialBlend',
      label: 'Initial Blend',
      correctName: 'initialBlendCorrect',
      attemptedName: 'initialBlendAttempted',
      percentCorrectName: 'initialBlendPercentCorrect',
    },
    {
      kind: 'itemLevel',
      key: 'tripleBlend',
      label: 'Triple Blend',
      correctName: 'tripleBlendCorrect',
      attemptedName: 'tripleBlendAttempted',
      percentCorrectName: 'tripleBlendPercentCorrect',
    },
    {
      kind: 'itemLevel',
      key: 'finalBlend',
      label: 'Final Blend',
      correctName: 'finalBlendCorrect',
      attemptedName: 'finalBlendAttempted',
      percentCorrectName: 'finalBlendPercentCorrect',
    },
    {
      kind: 'itemLevel',
      key: 'rControlled',
      label: 'R-Controlled',
      correctName: 'rControlledCorrect',
      attemptedName: 'rControlledAttempted',
      percentCorrectName: 'rControlledPercentCorrect',
    },
    {
      kind: 'itemLevel',
      key: 'rCluster',
      label: 'R-Cluster',
      correctName: 'rClusterCorrect',
      attemptedName: 'rClusterAttempted',
      percentCorrectName: 'rClusterPercentCorrect',
    },
    {
      kind: 'itemLevel',
      key: 'silentE',
      label: 'Silent E',
      correctName: 'silentECorrect',
      attemptedName: 'silentEAttempted',
      percentCorrectName: 'silentEPercentCorrect',
    },
    {
      kind: 'itemLevel',
      key: 'vowelTeam',
      label: 'Vowel Team',
      correctName: 'vowelTeamCorrect',
      attemptedName: 'vowelTeamAttempted',
      percentCorrectName: 'vowelTeamPercentCorrect',
    },
    { kind: 'number', key: 'totalPercentCorrect', label: 'Total % Correct', name: 'totalPercentCorrect', round: true },
  ],

  // ─────────── Phonological Awareness (PA) ───────────
  // Three subtask domains — First Sound (FSM), Last Sound (LSM), Deletion
  // (DEL) — plus a total and a computed `skillsToWorkOn`.
  pa: [
    {
      kind: 'itemLevel',
      key: 'firstSound',
      label: 'First Sound',
      correctName: 'fsmCorrect',
      attemptedName: 'fsmAttempted',
      percentCorrectName: 'fsmPercentCorrect',
    },
    {
      kind: 'itemLevel',
      key: 'lastSound',
      label: 'Last Sound',
      correctName: 'lsmCorrect',
      attemptedName: 'lsmAttempted',
      percentCorrectName: 'lsmPercentCorrect',
    },
    {
      kind: 'itemLevel',
      key: 'deletion',
      label: 'Deletion',
      correctName: 'delCorrect',
      attemptedName: 'delAttempted',
      percentCorrectName: 'delPercentCorrect',
    },
    {
      kind: 'itemLevel',
      key: 'total',
      label: 'Total',
      correctName: 'totalCorrect',
      attemptedName: 'totalAttempted',
      percentCorrectName: 'totalPercentCorrect',
    },
    { kind: 'paSkillsToWorkOn', key: 'skillsToWorkOn', label: 'Skills To Work On' },
  ],

  // ─────────── Letter (English + en-CA variant) ───────────
  // Item-level columns for lower case, upper case, letter sounds, and
  // total. Plus two computed-list passthrough columns:
  // `lettersToWorkOn` / `soundsToWorkOn`.
  letter: buildLetterColumns(),
  'letter-en-ca': buildLetterColumns(),

  // ─────────── ROAM Fluency ───────────
  // Two raw-score columns: free-response and forced-choice. Mirrors the
  // dashboard's `fluencyTasks` SubscoreTable branch.
  'fluency-arf': buildFluencyColumns(),
  'fluency-calf': buildFluencyColumns(),
  'fluency-arf-es': buildFluencyColumns(),
  'fluency-calf-es': buildFluencyColumns(),

  // ─────────── ROAM Alpaca (core math) ───────────
  // Total raw score + 5 per-domain percent-correct columns + a
  // computed `incorrectSkills` list.
  'roam-alpaca': [
    { kind: 'number', key: 'rawScore', label: 'Raw Score', name: 'roarScore' },
    {
      kind: 'number',
      key: 'numberKnowledge',
      label: 'Number Knowledge',
      name: 'numberKnowledgePercentCorrect',
      round: true,
    },
    { kind: 'number', key: 'geometry', label: 'Geometry', name: 'geometryPercentCorrect', round: true },
    {
      kind: 'number',
      key: 'arithmeticExpressions',
      label: 'Arithmetic Expressions',
      name: 'arithmeticExpressionsPercentCorrect',
      round: true,
    },
    {
      kind: 'number',
      key: 'rationalNumbersProbability',
      label: 'Rational Numbers & Probability',
      name: 'rationalNumbersProbabilityPercentCorrect',
      round: true,
    },
    {
      kind: 'number',
      key: 'algebraicThinking',
      label: 'Algebraic Thinking',
      name: 'algebraicThinkingPercentCorrect',
      round: true,
    },
    { kind: 'stringPassthrough', key: 'incorrectSkills', label: 'Skills To Work On', name: 'incorrectSkills' },
  ],
};

function buildLetterColumns(): TaskSubscoreColumnDef[] {
  return [
    { kind: 'stringPassthrough', key: 'lowerCase', label: 'Lower Case', name: 'lowerCaseScore' },
    { kind: 'stringPassthrough', key: 'upperCase', label: 'Upper Case', name: 'upperCaseScore' },
    { kind: 'stringPassthrough', key: 'letterSounds', label: 'Letter Sounds', name: 'phonemeScore' },
    { kind: 'stringPassthrough', key: 'total', label: 'Total', name: 'totalScore' },
    { kind: 'stringPassthrough', key: 'lettersToWorkOn', label: 'Letters To Work On', name: 'incorrectLetters' },
    { kind: 'stringPassthrough', key: 'soundsToWorkOn', label: 'Sounds To Work On', name: 'incorrectPhonemes' },
  ];
}

function buildFluencyColumns(): TaskSubscoreColumnDef[] {
  return [
    { kind: 'number', key: 'freeResponse', label: 'Free Response', name: 'frRawScore' },
    { kind: 'number', key: 'multipleChoice', label: 'Multiple Choice', name: 'fcRawScore' },
  ];
}

// --- Public helpers ---

/**
 * Returns the column definitions registered for a task slug, or `null`
 * when the task has no subscore table. Tasks without a registry entry
 * cause the task-subscores endpoint to return 400.
 *
 * @param taskSlug - The task slug
 * @returns The column definitions, or `null` if the task has no subscore table
 */
export function getTaskSubscoreColumns(taskSlug: string): TaskSubscoreColumnDef[] | null {
  return TASK_SUBSCORE_TABLE[taskSlug] ?? null;
}

/**
 * Returns the registered (key, label) metadata pairs for the API response,
 * stripping all internal value-source details.
 *
 * @param taskSlug - The task slug
 * @returns Public column metadata, or `null` if the task has no subscore table
 */
export function getPublicSubscoreColumns(taskSlug: string): Array<{ key: string; label: string }> | null {
  const cols = getTaskSubscoreColumns(taskSlug);
  if (!cols) return null;
  return cols.map(({ key, label }) => ({ key, label }));
}

/**
 * For a given column key on a task, return the `run_scores.name` whose
 * value carries the column's numeric representation — used by the
 * repository to compile sort/filter SQL on `subscores.<key>` paths.
 *
 * Returns `null` when the column has no numeric form (e.g., string-only
 * passthrough columns or the computed PA `skillsToWorkOn`).
 *
 * @param taskSlug - The task slug
 * @param columnKey - The API-facing column key
 * @returns The numeric `run_scores.name`, or `null` if the column isn't numerically sortable/filterable
 */
export function getNumericFieldNameForSubscore(taskSlug: string, columnKey: string): string | null {
  const col = getTaskSubscoreColumns(taskSlug)?.find((c) => c.key === columnKey);
  if (!col) return null;
  if (col.kind === 'itemLevel') return col.percentCorrectName ?? null;
  if (col.kind === 'number') return col.name;
  return null;
}

/**
 * Resolve a column's value for a single student row.
 *
 * Caller passes:
 * - `taskSlug` — drives column dispatch via the registry
 * - `column` — the column definition to evaluate
 * - `scoreMap` — the student's `run_scores.name → value` map for this run
 * - `paSubscores` — optional pre-extracted PA subscore data (only consulted
 *   for the `paSkillsToWorkOn` column kind; passed in so the caller can
 *   reuse the already-extracted result without re-walking the score map)
 * - `paLegacyRoarScore` — optional legacy fallback for PA's
 *   `paSkillsToWorkOn` column when subscore percent-correct data is
 *   missing (matches the legacy frontend's threshold path)
 *
 * Returns `string | number | null` — `null` when the underlying score
 * row(s) are missing.
 */
export function formatTaskSubscoreColumnValue(args: {
  column: TaskSubscoreColumnDef;
  scoreMap: Map<string, string>;
  /** PA-only: pre-extracted subscore record, keyed by registry key (FSM/LSM/DEL). */
  paSubscores?: Record<string, { correct: number | null; attempted: number | null; percentCorrect: number | null }>;
  /** PA-only: legacy roarScore numeric fallback. */
  paLegacyRoarScore?: number | null;
  /** PA-only: precomputed skills-to-work-on list (caller already ran computeSkillsToWorkOn). */
  paSkillsToWorkOn?: string[] | null;
}): string | number | null {
  const { column, scoreMap, paSkillsToWorkOn } = args;

  switch (column.kind) {
    case 'itemLevel': {
      const correctRaw = scoreMap.get(column.correctName);
      const attemptedRaw = scoreMap.get(column.attemptedName);
      if (correctRaw === undefined && attemptedRaw === undefined) return null;
      // Render with the raw strings so we don't lose nuance like "<1" or
      // ">99" — `correct/attempted` is meant for display, not arithmetic.
      // Default missing halves to "0" so the column is still renderable
      // when partial data lands.
      return `${correctRaw ?? '0'}/${attemptedRaw ?? '0'}`;
    }

    case 'number': {
      const raw = scoreMap.get(column.name);
      if (raw === undefined) return null;
      const numeric = Number(raw);
      if (Number.isNaN(numeric)) return null;
      return column.round ? Math.round(numeric) : numeric;
    }

    case 'stringPassthrough': {
      const raw = scoreMap.get(column.name);
      if (raw === undefined || raw === null) return null;
      return raw;
    }

    case 'paSkillsToWorkOn': {
      if (!paSkillsToWorkOn || paSkillsToWorkOn.length === 0) return null;
      return paSkillsToWorkOn.join(', ');
    }
  }
}

// --- Drizzle column reference (just used for type alias parity with the
// rest of the codebase — kept so the registry doesn't need to import the
// runtime Drizzle module) ---
export type DrizzleColumn = Column;
