import { z } from 'zod';

/**
 * Exclusions metadata for reporting list responses.
 *
 * Surfaces counts of records that were filtered out of the result set, so
 * the frontend can explain a sparse historical report. The schema is
 * open-ended on purpose — future exclusion categories (e.g., `enrollmentEnded`)
 * can be added without a breaking response-shape change.
 *
 * Initial keys:
 * - `rosteringEnded`: count of unique users excluded because of rostering-end
 *   (either the user's own `rosteringEnded` was set or their in-scope parent
 *   entity's `rosteringEnded` was set). See #1742.
 *
 * The count is aggregate across the report scope, not per-org / per-class.
 * A user excluded for multiple reasons is counted once.
 */
export const ExclusionsSchema = z.object({
  rosteringEnded: z.number().int().nonnegative(),
});

export type Exclusions = z.infer<typeof ExclusionsSchema>;
