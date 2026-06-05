/**
 * Seed script for the ROAR Phonological Awareness (PA) task and its default variants.
 *
 * Seeds the `tasks`, `task_variants`, and `task_variant_parameters` tables with the
 * PA task definition and two default variants (English fixed-form and English adaptive).
 *
 * Idempotent — safe to run multiple times. Existing records are left unchanged.
 *
 * Usage:
 *   npm run db:seed:pa -w apps/backend
 *
 * Requires CORE_DATABASE_URL to be set in the environment.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { pa } from '@roar-platform/assessment-schema';
import * as CoreDbSchema from '../src/db/schema/core';
import { tasks, taskVariants, taskVariantParameters } from '../src/db/schema/core';

const { PA_TASK_ID, PA_VARIANT_KINDS, PA_LANGUAGES } = pa;

const CORE_DATABASE_URL = process.env.CORE_DATABASE_URL;
if (!CORE_DATABASE_URL) throw new Error('CORE_DATABASE_URL is required');

const pool = new Pool({ connectionString: CORE_DATABASE_URL });
const db = drizzle(pool, { schema: CoreDbSchema, casing: 'snake_case' });

const DEFAULT_VARIANTS = Object.values(PA_LANGUAGES).flatMap((lang) =>
  Object.values(PA_VARIANT_KINDS).map((kind) => ({
    name: `${lang.label} ${kind.label}`,
    description: `${kind.description} (${lang.label})`,
    params: {
      language: lang.code,
      isAdaptive: kind.isAdaptive,
      itemSelect: kind.itemSelect,
      scoringVersion: kind.scoringVersion,
      scoreKind: kind.scoreKind,
    },
  })),
);

async function seed() {
  console.log('Seeding PA task...');

  const [inserted] = await db
    .insert(tasks)
    .values({
      slug: PA_TASK_ID,
      name: 'Phonological Awareness',
      nameSimple: 'Phonological Awareness',
      nameTechnical: 'Rapid Online Assessment of Reading — Phonological Awareness',
      description:
        'Measures phonological awareness skills including first sound matching, last sound matching, and phoneme deletion.',
      taskConfig: {},
    })
    .onConflictDoNothing()
    .returning();

  const task = inserted ?? (await db.query.tasks.findFirst({ where: eq(tasks.slug, PA_TASK_ID) }));

  if (!task) throw new Error('Failed to insert or find PA task');

  if (inserted) {
    console.log(`Inserted PA task: ${task.id}`);
  } else {
    console.log(`PA task already exists (${task.id}), skipping insert.`);
  }

  for (const { name, description, params } of DEFAULT_VARIANTS) {
    // Query-first: the unique index on task_variants is a functional partial index
    // (lower(name) WHERE name IS NOT NULL), which Drizzle cannot target in
    // onConflictDoNothing — so we check existence explicitly rather than relying
    // on a bare conflict clause that would silently swallow unexpected errors.
    // Safe in this script because assessment-db-migrate runs as a one-shot via docker compose; concurrent invocation would race each other.
    const existing = await db.query.taskVariants.findFirst({
      where: and(eq(taskVariants.taskId, task.id), eq(taskVariants.name, name)),
    });

    if (existing) {
      console.log(`Variant "${name}" already exists (${existing.id}), skipping.`);
      continue;
    }

    const [variant] = await db
      .insert(taskVariants)
      .values({
        taskId: task.id,
        name,
        description,
        status: 'published',
      })
      .returning();

    if (!variant) throw new Error(`Failed to insert variant "${name}"`);

    console.log(`Inserted variant "${name}": ${variant.id}`);

    await db
      .insert(taskVariantParameters)
      .values(
        Object.entries(params).map(([paramName, value]) => ({
          taskVariantId: variant.id,
          name: paramName,
          value,
        })),
      )
      .onConflictDoNothing({ target: [taskVariantParameters.taskVariantId, taskVariantParameters.name] });

    console.log(`Inserted ${Object.keys(params).length} parameters for "${name}"`);
  }

  console.log('Seeding complete.');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
