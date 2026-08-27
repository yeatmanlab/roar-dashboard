/**
 * Assign an existing task variant to an existing administration.
 *
 * `dev:seed:tasks` assigns each config's `defaultVariant` to the dev fixture
 * administration automatically. This script covers everything that isn't that case:
 * a different administration, a variant other than the default, or a database whose
 * administrations came from somewhere other than the dev fixture.
 *
 * Usage:
 *   npm run dev:assign:variant -- --administration <uuid> --slug swr
 *   npm run dev:assign:variant -- --administration <uuid> --slug swr --variant 'English-v7'
 *
 * Without `--variant`, the task must have exactly one variant, so the choice is
 * unambiguous. Idempotent — re-running is a no-op.
 *
 * Environment variables:
 * - CORE_DATABASE_URL: Core database connection string (required)
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';

import * as CoreDbSchema from '../src/db/schema/core';
import { administrations, tasks, taskVariants } from '../src/db/schema/core';
import { assignTaskVariant } from './utils/assign-task-variant';

/** How many variant names to show when `--variant` is needed but wasn't given. */
const MAX_LISTED_VARIANTS = 10;

// ─── CLI arguments ───────────────────────────────────────────────────────────

function flag(name: string): string | undefined {
  return process.argv.find((_, i, arr) => arr[i - 1] === `--${name}`);
}

const administrationId = flag('administration');
const slug = flag('slug');
const variantName = flag('variant');

if (!administrationId || !slug) {
  console.error('Usage: npm run dev:assign:variant -- --administration <uuid> --slug <task-slug> [--variant <name>]');
  process.exit(1);
}

const CORE_DATABASE_URL = process.env.CORE_DATABASE_URL;
if (!CORE_DATABASE_URL) throw new Error('CORE_DATABASE_URL is required');

const pool = new Pool({ connectionString: CORE_DATABASE_URL });
const db = drizzle(pool, { schema: CoreDbSchema, casing: 'snake_case' });

// ─── Resolution ──────────────────────────────────────────────────────────────

/** Fail with a readable message rather than a constraint violation from Postgres. */
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function resolveVariant(): Promise<{ id: string; name: string | null }> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.slug, slug!),
    columns: { id: true },
  });

  if (!task) fail(`No task with slug "${slug}". Seed it first: npm run dev:seed:tasks -- --task <assessment>`);

  if (variantName) {
    const variant = await db.query.taskVariants.findFirst({
      where: and(eq(taskVariants.taskId, task.id), eq(taskVariants.name, variantName)),
      columns: { id: true, name: true },
    });
    if (!variant) fail(`Task "${slug}" has no variant named "${variantName}".`);
    return variant;
  }

  const candidates = await db
    .select({ id: taskVariants.id, name: taskVariants.name })
    .from(taskVariants)
    .where(eq(taskVariants.taskId, task.id));

  if (candidates.length === 0) fail(`Task "${slug}" has no variants.`);
  if (candidates.length > 1) {
    // A seeded task can carry hundreds of variants against imported data — list a
    // sample rather than flooding the terminal.
    const sample = candidates.slice(0, MAX_LISTED_VARIANTS).map((c) => `  --variant '${c.name}'`);
    const remaining = candidates.length - sample.length;
    const suffix = remaining > 0 ? `\n  …and ${remaining} more (query task_variants for the full list)` : '';
    fail(`Task "${slug}" has ${candidates.length} variants — name one explicitly:\n${sample.join('\n')}${suffix}`);
  }

  return candidates[0]!;
}

async function main(): Promise<void> {
  const administration = await db.query.administrations.findFirst({
    where: eq(administrations.id, administrationId!),
    columns: { id: true, name: true },
  });

  if (!administration) fail(`No administration with id "${administrationId}".`);

  const variant = await resolveVariant();

  const orderIndex = await assignTaskVariant(db, administration.id, variant.id);

  if (orderIndex === null) {
    console.log(`"${variant.name}" (${slug}) is already assigned to "${administration.name}", skipping.`);
    return;
  }

  console.log(`Assigned "${variant.name}" (${slug}) to "${administration.name}" at order ${orderIndex}.`);
}

main()
  .catch((err) => {
    console.error('Assignment failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
