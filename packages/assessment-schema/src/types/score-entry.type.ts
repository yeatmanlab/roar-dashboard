import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';

/**
 * Minimum shape that every assessment's ScoreEntry type must satisfy.
 * Used as a compile-time guard via:
 *
 *   export type _TypeCheck = XxxScoreEntry extends ScoreEntryConstraint ? true : false;
 *
 * This assertion lives in each assessment's score-entries.ts alongside the
 * toXxxScoreEntries converter function. The pattern for a new assessment is:
 *
 * 1. Define `XxxScoreEntry` (interface) with assessment-specific `name` union type.
 * 2. Add `export type _TypeCheck = XxxScoreEntry extends ScoreEntryConstraint ? true : false;`
 * 3. Implement `toXxxScoreEntries(computed, { strict }) → XxxScoreEntry[]` that iterates
 *    the computed score object and emits one entry per field, assigning ScoreType.RAW for
 *    direct measurements and ScoreType.COMPUTED for derived/normed values.
 * 4. Pass `toXxxScoreEntries` as `_getScoreAdapter` in the assessment's firekit facade.
 *
 * Reference implementations: roar-pa/score-entries.ts, roar-swr/score-entries.ts,
 * roar-sre/score-entries.ts.
 */
export type ScoreEntryConstraint = {
  type: ScoreType;
  domain: string;
  name: string;
  value: string;
  assessmentStage: AssessmentStage;
  categoryScore?: boolean;
};
