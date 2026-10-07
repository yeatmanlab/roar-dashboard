import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { fdwRunScores } from '../../db/schema/assessment-fdw/run-scores';
import { SCORE_DOMAIN } from '../../constants/run-scores';

/**
 * Restrict a `run_scores` read to the composite domain.
 *
 * Not constrained on `type`: some configs point `scoreFields` at names written
 * as `type='raw'` (e.g. phonics `totalCorrect`, swr-it `numCorrect`).
 *
 * Assumes each `(domain, name)` exists under one `type` only, so leaving `type`
 * out can't make a read ambiguous. Nothing enforces that — it holds because the
 * `to*ScoreEntries` converters assign `type` from the score name.
 *
 * @returns A Drizzle `SQL` predicate matching composite-domain score rows
 */
export function compositeScoreFilter(): SQL {
  return eq(fdwRunScores.domain, SCORE_DOMAIN.COMPOSITE);
}
