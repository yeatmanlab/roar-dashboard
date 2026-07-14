/**
 * Seed script for the ROAR Read Aloud task and variants.
 *
 * Reads variant definitions from the file at TASK_VARIANT_PARAMETERS_FILE (required).
 * The file is a JSON array where each entry has a variantName and a params object whose
 * keys match the gameParams in roar-readaloud's serve.js. Read Aloud is a single English
 * task (roar-readaloud), so every variant is seeded under it.
 *
 * Idempotent — the task and variants that already exist by slug / name are skipped.
 *
 * Usage:
 *   TASK_VARIANT_PARAMETERS_FILE=./taskVariantParameters.json npm run db:seed:roar-readaloud -w apps/backend
 *
 * To get started, copy taskVariantParameters.example.json in the assessment directory:
 *   cp apps/assessments/roar-readaloud/taskVariantParameters.example.json \
 *      apps/assessments/roar-readaloud/taskVariantParameters.json
 *
 * Requires CORE_DATABASE_URL and TASK_VARIANT_PARAMETERS_FILE to be set.
 */

import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { readaloud } from '@roar-platform/assessment-schema';
import * as CoreDbSchema from '../src/db/schema/core';
import { tasks, taskVariants, taskVariantParameters } from '../src/db/schema/core';

const { READALOUD_TASK_ID, READALOUD_TASK } = readaloud;

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
  params: Record<string, unknown>;
};

// ─── Validation ──────────────────────────────────────────────────────────────

// The keys serve.js passes as gameParams. Unknown keys are rejected to catch typos.
const ALLOWED_PARAM_KEYS = new Set([
  'taskName',
  'testConfigFile',
  'deviceConfigFile',
  'consent',
  'viewType',
  'viewingDistance',
  'bViewingDistancePage',
  'calibrationType',
  'bEyeTracking',
  'visibleEyeTracking',
  'storeAudio',
  'storeVideo',
  'skipInstructions',
  'keyHelpers',
  'practiceCorpus',
  'stimulusCorpus',
  'storyCorpus',
  'sequentialPractice',
  'sequentialStimulus',
  'buttonLayout',
  'numOfPracticeTrials',
  'numberOfTrials',
  'stimulusBlocks',
  'story',
]);

function validateVariants(raw: unknown): VariantDef[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('taskVariantParameters.json must be a non-empty array');
  }

  return raw.map((entry: unknown, i: number) => {
    const label = `Entry [${i}]`;

    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${label}: must be an object`);
    }

    const { variantName, params } = entry as Record<string, unknown>;

    if (typeof variantName !== 'string' || variantName.trim() === '') {
      throw new Error(`${label}: "variantName" must be a non-empty string`);
    }

    const name = variantName.trim();
    const loc = `${label} ("${name}")`;

    if (typeof params !== 'object' || params === null || Array.isArray(params)) {
      throw new Error(`${loc}: "params" must be an object`);
    }

    const p = params as Record<string, unknown>;

    for (const key of Object.keys(p)) {
      if (!ALLOWED_PARAM_KEYS.has(key)) {
        throw new Error(`${loc}: unknown param "${key}"`);
      }
    }

    if ('taskName' in p && p.taskName !== READALOUD_TASK_ID) {
      throw new Error(`${loc}: "taskName" must be "${READALOUD_TASK_ID}" or omitted`);
    }

    return { variantName: name, params: p };
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

async function seedTask(): Promise<{ id: string }> {
  const [inserted] = await db
    .insert(tasks)
    .values({
      slug: READALOUD_TASK_ID,
      name: READALOUD_TASK.name,
      nameSimple: READALOUD_TASK.nameSimple,
      nameTechnical: READALOUD_TASK.nameTechnical,
      taskConfig: {},
    })
    .onConflictDoNothing()
    .returning();

  const task = inserted ?? (await db.query.tasks.findFirst({ where: eq(tasks.slug, READALOUD_TASK_ID) }));
  if (!task) throw new Error(`Failed to insert or find task "${READALOUD_TASK_ID}"`);

  if (inserted) {
    console.log(`  Inserted task "${READALOUD_TASK_ID}": ${task.id}`);
  } else {
    console.log(`  Task "${READALOUD_TASK_ID}" already exists (${task.id}), skipping.`);
  }

  return task;
}

async function seedVariant(taskId: string, def: VariantDef): Promise<void> {
  // Query-first: the unique index on task_variants is a functional partial index
  // (lower(name) WHERE name IS NOT NULL), which Drizzle cannot target in
  // onConflictDoNothing — so we check existence explicitly.
  const existing = await db.query.taskVariants.findFirst({
    where: (variants, { and, eq }) => and(eq(variants.taskId, taskId), eq(variants.name, def.variantName)),
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

  // Omit null/undefined params — only store params with explicit values.
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

    console.log(`  Inserted ${paramEntries.length} parameters for "${def.variantName}"`);
  }
}

async function seed(): Promise<void> {
  console.log(`Reading variants from ${TASK_VARIANT_PARAMETERS_FILE}`);
  console.log(`Found ${variantDefs.length} variant(s) to seed.\n`);

  console.log(`Seeding task "${READALOUD_TASK_ID}"...`);
  const task = await seedTask();

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
