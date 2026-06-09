/**
 * Seed script for the ROAR Single Word Recognition (SWR) tasks and their default variants.
 *
 * SWR has one task per language (swr, swr-es, swr-it, swr-pt, swr-de), each with a single
 * default variant. Seeds the `tasks`, `task_variants`, and `task_variant_parameters` tables.
 *
 * Idempotent — safe to run multiple times. Existing records are left unchanged.
 *
 * Usage:
 *   npm run db:seed:swr -w apps/backend
 *
 * Requires CORE_DATABASE_URL to be set in the environment.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { swr } from '@roar-platform/assessment-schema';
import * as CoreDbSchema from '../src/db/schema/core';
import { tasks, taskVariants, taskVariantParameters } from '../src/db/schema/core';

const { SWR_LANGUAGES } = swr;

const CORE_DATABASE_URL = process.env.CORE_DATABASE_URL;
if (!CORE_DATABASE_URL) throw new Error('CORE_DATABASE_URL is required');

const pool = new Pool({ connectionString: CORE_DATABASE_URL });
const db = drizzle(pool, { schema: CoreDbSchema, casing: 'snake_case' });

type TaskDef = {
  slug: string;
  name: string;
  nameSimple: string;
  nameTechnical: string;
  variantName: string;
  params: Record<string, string | number>;
};

function buildTaskDefs(): TaskDef[] {
  return Object.values(SWR_LANGUAGES).map((lang) => {
    const isEnglish = lang.code === 'en';
    const languageSuffix = isEnglish ? '' : ` (${lang.label})`;
    const variantName =
      lang.defaultScoringVersion !== null ? `${lang.label} (v${lang.defaultScoringVersion})` : lang.label;

    const params: Record<string, string | number> = { lng: lang.code };
    if (lang.defaultScoringVersion !== null) {
      params.scoringVersion = lang.defaultScoringVersion;
    }

    return {
      slug: lang.taskId,
      name: `Single Word Recognition${languageSuffix}`,
      nameSimple: `SWR${isEnglish ? '' : `-${lang.code.toUpperCase()}`}`,
      nameTechnical: `Rapid Online Assessment of Reading — Single Word Recognition${languageSuffix}`,
      variantName,
      params,
    };
  });
}

async function seedTask(taskDef: TaskDef) {
  console.log(`\nSeeding SWR task: ${taskDef.slug}`);

  const [inserted] = await db
    .insert(tasks)
    .values({
      slug: taskDef.slug,
      name: taskDef.name,
      nameSimple: taskDef.nameSimple,
      nameTechnical: taskDef.nameTechnical,
      taskConfig: {},
    })
    .onConflictDoNothing()
    .returning();

  const task = inserted ?? (await db.query.tasks.findFirst({ where: eq(tasks.slug, taskDef.slug) }));

  if (!task) throw new Error(`Failed to insert or find task "${taskDef.slug}"`);

  if (inserted) {
    console.log(`  Inserted task: ${task.id}`);
  } else {
    console.log(`  Task already exists (${task.id}), skipping insert.`);
  }

  // Query-first: the unique index on task_variants is a functional partial index
  // (lower(name) WHERE name IS NOT NULL), which Drizzle cannot target in
  // onConflictDoNothing — so we check existence explicitly.
  const existing = await db.query.taskVariants.findFirst({
    where: and(eq(taskVariants.taskId, task.id), eq(taskVariants.name, taskDef.variantName)),
  });

  if (existing) {
    console.log(`  Variant "${taskDef.variantName}" already exists (${existing.id}), skipping.`);
    return;
  }

  const [variant] = await db
    .insert(taskVariants)
    .values({
      taskId: task.id,
      name: taskDef.variantName,
      status: 'published',
    })
    .returning();

  if (!variant) throw new Error(`Failed to insert variant "${taskDef.variantName}"`);

  console.log(`  Inserted variant "${taskDef.variantName}": ${variant.id}`);

  await db
    .insert(taskVariantParameters)
    .values(
      Object.entries(taskDef.params).map(([paramName, value]) => ({
        taskVariantId: variant.id,
        name: paramName,
        value,
      })),
    )
    .onConflictDoNothing({ target: [taskVariantParameters.taskVariantId, taskVariantParameters.name] });

  console.log(`  Inserted ${Object.keys(taskDef.params).length} parameters for "${taskDef.variantName}"`);
}

async function seed() {
  console.log('Seeding SWR tasks...');

  const taskDefs = buildTaskDefs();
  for (const taskDef of taskDefs) {
    await seedTask(taskDef);
  }

  console.log('\nSeeding complete.');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
