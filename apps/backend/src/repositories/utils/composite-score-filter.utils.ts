import { and, eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { fdwRunScores } from '../../db/schema/assessment-fdw/run-scores';
import { SCORE_DOMAIN, SCORE_TYPE } from '../../constants/run-scores';

/**
 * Restrict a `run_scores` read to the rows `scoreFields` addresses: computed
 * scores in the composite domain.
 *
 * @returns A Drizzle `SQL` predicate matching composite computed score rows
 */
export function compositeComputedScoreFilter(): SQL {
  return and(eq(fdwRunScores.type, SCORE_TYPE.COMPUTED), eq(fdwRunScores.domain, SCORE_DOMAIN.COMPOSITE))!;
}
