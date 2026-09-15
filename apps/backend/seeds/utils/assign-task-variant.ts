/**
 * Assign a task variant to an administration.
 *
 * Shared by `task-seed.ts` (assigning each config's `defaultVariant` to the launch
 * sandbox) and `assign-variant.ts` (assigning an arbitrary pair). Both need the same
 * next-order-index computation and the same narrowly-scoped conflict handling, so it
 * lives here rather than in two copies that can drift apart.
 */
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as CoreDbSchema from '../../src/db/schema/core';
import { administrationTaskVariants } from '../../src/db/schema/core';

/**
 * Assign a variant, appending it after the administration's existing tasks.
 *
 * Idempotent: re-assigning a variant already present is a no-op. The conflict target
 * is scoped to the primary key (administrationId, taskVariantId) deliberately — the
 * table also carries a unique index on (administrationId, orderIndex), and an
 * unscoped `onConflictDoNothing` would absorb that collision too, reporting a failed
 * assignment as a successful dedup.
 *
 * The read-then-insert is not atomic. Concurrent callers can compute the same order
 * index, in which case the loser now raises a unique violation instead of silently
 * doing nothing — the right failure mode for a dev script, though not a substitute
 * for locking if these ever run in parallel.
 *
 * @param db - Core database handle
 * @param administrationId - The administration to assign into
 * @param taskVariantId - The variant to assign
 * @returns The order index it was assigned at, or `null` if it was already assigned
 */
export async function assignTaskVariant(
  db: NodePgDatabase<typeof CoreDbSchema>,
  administrationId: string,
  taskVariantId: string,
): Promise<number | null> {
  const assigned = await db
    .select({ orderIndex: administrationTaskVariants.orderIndex })
    .from(administrationTaskVariants)
    .where(eq(administrationTaskVariants.administrationId, administrationId));

  const nextOrderIndex = assigned.reduce((max, row) => Math.max(max, row.orderIndex + 1), 0);

  const [inserted] = await db
    .insert(administrationTaskVariants)
    .values({ administrationId, taskVariantId, orderIndex: nextOrderIndex })
    .onConflictDoNothing({
      target: [administrationTaskVariants.administrationId, administrationTaskVariants.taskVariantId],
    })
    .returning();

  return inserted ? nextOrderIndex : null;
}
