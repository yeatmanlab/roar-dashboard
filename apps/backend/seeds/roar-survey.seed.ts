/**
 * Seed script for the ROAR Survey task and its variants.
 *
 * Reads variant definitions from the file at TASK_VARIANT_PARAMETERS_FILE (required).
 * The file is a JSON array where each entry has a variantName and a params object
 * with a required "survey" key (the GCS filename, without the .json extension).
 *
 * Idempotent — the task and any variants that already exist are skipped.
 *
 * Usage:
 *   TASK_VARIANT_PARAMETERS_FILE=./taskVariantParameters.json npm run db:seed:roar-survey -w apps/backend
 *
 * To get started, copy taskVariantParameters.example.json in the assessment directory:
 *   cp apps/assessments/roar-survey/taskVariantParameters.example.json \
 *      apps/assessments/roar-survey/taskVariantParameters.json
 *
 * Requires CORE_DATABASE_URL and TASK_VARIANT_PARAMETERS_FILE to be set.
 */

import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { survey } from '@roar-platform/assessment-schema';
import * as CoreDbSchema from '../src/db/schema/core';
import { tasks, taskVariants, taskVariantParameters } from '../src/db/schema/core';

const { SURVEY_TASK_ID } = survey;

// ─── Environment ─────────────────────────────────────────────────────────────

const CORE_DATABASE_URL = process.env.CORE_DATABASE_URL;
if (!CORE_DATABASE_URL) throw new Error('CORE_DATABASE_URL is required');

const TASK_VARIANT_PARAMETERS_FILE = process.env.TASK_VARIANT_PARAMETERS_FILE;
if (!TASK_VARIANT_PARAMETERS_FILE) {
  throw new Error(
    'TASK_VARIANT_PARAMETERS_FILE is required.\n' +
      'Copy taskVariantParameters.example.json to taskVariantParameters.json in the assessment directory.',
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type VariantDef = {
  variantName: string;
  params: { survey: string } & Record<string, unknown>;
};

// ─── Validation ──────────────────────────────────────────────────────────────

function validateVariants(raw: unknown): VariantDef[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('taskVariantParameters.json must be a non-empty array');
  }

  return raw.map((entry: unknown, i) => {
    const label = `Entry [${i}]`;

    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${label}: must be an object`);
    }

    const { variantName, params } = entry as Record<string, unknown>;

    if (typeof variantName !== 'string' || variantName.trim() === '') {
      throw new Error(`${label}: "variantName" must be a non-empty string`);
    }

    if (typeof params !== 'object' || params === null || Array.isArray(params)) {
      throw new Error(`${label} ("${variantName}"): "params" must be an object`);
    }

    const p = params as Record<string, unknown>;
    if (typeof p.survey !== 'string' || p.survey.trim() === '') {
      throw new Error(`${label} ("${variantName}"): "params.survey" must be a non-empty string`);
    }

    return { variantName: variantName.trim(), params: p as VariantDef['params'] };
  });
}

// ─── Load and validate file ───────────────────────────────────────────────────

let variantDefs: VariantDef[];

try {
  const raw = JSON.parse(readFileSync(TASK_VARIANT_PARAMETERS_FILE, 'utf-8'));
  variantDefs = validateVariants(raw);
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
    throw new Error(
      `taskVariantParameters.json not found at ${TASK_VARIANT_PARAMETERS_FILE}.\n` +
        'Copy taskVariantParameters.example.json to get started.',
    );
  }
  throw err;
}

// ─── Database ─────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: CORE_DATABASE_URL });
const db = drizzle(pool, { schema: CoreDbSchema, casing: 'snake_case' });

// ─── Seeding ──────────────────────────────────────────────────────────────────

async function seedVariant(taskId: string, def: VariantDef): Promise<void> {
  const existing = await db.query.taskVariants.findFirst({
    where: and(eq(taskVariants.taskId, taskId), eq(taskVariants.name, def.variantName)),
  });

  if (existing) {
    console.log(`  Variant "${def.variantName}" already exists (${existing.id}), skipping.`);
    return;
  }

  const [variant] = await db
    .insert(taskVariants)
    .values({ taskId, name: def.variantName, status: 'published' })
    .returning();

  if (!variant) throw new Error(`Failed to insert variant "${def.variantName}"`);

  console.log(`  Inserted variant "${def.variantName}": ${variant.id}`);

  const paramEntries = Object.entries(def.params).filter(([, v]) => v !== null && v !== undefined);

  if (paramEntries.length > 0) {
    await db
      .insert(taskVariantParameters)
      .values(
        paramEntries.map(([name, value]) => ({
          taskVariantId: variant.id,
          name,
          value,
        })),
      )
      .onConflictDoNothing({ target: [taskVariantParameters.taskVariantId, taskVariantParameters.name] });

    console.log(`  Inserted ${paramEntries.length} parameter(s) for "${def.variantName}"`);
  }
}

async function seed(): Promise<void> {
  console.log(`Reading variants from ${TASK_VARIANT_PARAMETERS_FILE}`);
  console.log(`Found ${variantDefs.length} variant(s) to seed.\n`);

  console.log(`Seeding task "${SURVEY_TASK_ID}"...`);

  const [insertedTask] = await db
    .insert(tasks)
    .values({
      slug: SURVEY_TASK_ID,
      name: 'Survey',
      nameSimple: 'Survey',
      nameTechnical: 'ROAR Survey',
      taskConfig: {},
    })
    .onConflictDoNothing()
    .returning();

  const task = insertedTask ?? (await db.query.tasks.findFirst({ where: eq(tasks.slug, SURVEY_TASK_ID) }));

  if (!task) throw new Error(`Failed to insert or find task "${SURVEY_TASK_ID}"`);

  if (insertedTask) {
    console.log(`  Inserted task "${SURVEY_TASK_ID}": ${task.id}`);
  } else {
    console.log(`  Task "${SURVEY_TASK_ID}" already exists (${task.id}), skipping.`);
  }

  for (const def of variantDefs) {
    console.log(`\nSeeding variant "${def.variantName}"...`);
    await seedVariant(task.id, def);
  }

  console.log('\nSeeding complete.');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
