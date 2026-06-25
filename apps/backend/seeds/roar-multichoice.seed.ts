/**
 * Seed script for ROAR Multichoice tasks and variants.
 *
 * Reads variant definitions from the file at TASK_VARIANT_PARAMETERS_FILE (required).
 * The file is a JSON array where each entry has a variantName and a params object whose
 * keys match the gameParams in roar-multichoice's serve.js. The task to seed under is
 * determined by the required "task" param: "morphology" or "cva".
 *
 * Idempotent — tasks and variants that already exist by slug / name are skipped.
 *
 * Usage:
 *   TASK_VARIANT_PARAMETERS_FILE=./taskVariantParameters.json npm run db:seed:roar-multichoice -w apps/backend
 *
 * To get started, copy taskVariantParameters.example.json in the assessment directory:
 *   cp apps/assessments/roar-multichoice/taskVariantParameters.example.json \
 *      apps/assessments/roar-multichoice/taskVariantParameters.json
 *
 * Requires CORE_DATABASE_URL and TASK_VARIANT_PARAMETERS_FILE to be set.
 */

import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { multichoice } from '@roar-platform/assessment-schema';
import * as CoreDbSchema from '../src/db/schema/core';
import { tasks, taskVariants, taskVariantParameters } from '../src/db/schema/core';

const { MORPHOLOGY_TASK_ID, CVA_TASK_ID, MULTICHOICE_SCORING_VERSION } = multichoice;

// ─── Environment ─────────────────────────────────────────────────────────────

const CORE_DATABASE_URL = process.env.CORE_DATABASE_URL;
if (!CORE_DATABASE_URL) throw new Error('CORE_DATABASE_URL is required');

const TASK_VARIANT_PARAMETERS_FILE = process.env.TASK_VARIANT_PARAMETERS_FILE;
if (!TASK_VARIANT_PARAMETERS_FILE) {
  throw new Error(
    'TASK_VARIANT_PARAMETERS_FILE is required.\n' + 'Copy taskVariantParameters.example.json to get started.',
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type MultichoiceTask = typeof MORPHOLOGY_TASK_ID | typeof CVA_TASK_ID;

type VariantDef = {
  variantName: string;
  params: Record<string, unknown>;
  /** Resolved task slug — determined during validation */
  taskSlug: MultichoiceTask;
};

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_TASK_VALUES = new Set<string>([MORPHOLOGY_TASK_ID, CVA_TASK_ID]);
const VALID_SCORING_VERSIONS = new Set<unknown>(Object.values(MULTICHOICE_SCORING_VERSION));

function validateVariants(raw: unknown): VariantDef[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('taskVariantParameters.json must be a non-empty array');
  }

  const results: VariantDef[] = [];

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i] as unknown;
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

    if (typeof p.task !== 'string' || !VALID_TASK_VALUES.has(p.task)) {
      throw new Error(`${loc}: "params.task" must be "${MORPHOLOGY_TASK_ID}" or "${CVA_TASK_ID}"`);
    }

    if ('scoringVersion' in p && p.scoringVersion !== null && p.scoringVersion !== undefined) {
      if (!VALID_SCORING_VERSIONS.has(p.scoringVersion)) {
        throw new Error(`${loc}: "scoringVersion" must be one of ${[...VALID_SCORING_VERSIONS].join(', ')} or omitted`);
      }
    }

    results.push({ variantName: name, params: p, taskSlug: p.task as MultichoiceTask });
  }

  return results;
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

// ─── Task metadata ────────────────────────────────────────────────────────────

const TASK_METADATA = {
  [MORPHOLOGY_TASK_ID]: {
    name: 'Morphology',
    nameSimple: 'Morphology',
    nameTechnical: 'Rapid Online Assessment of Reading — Morphology',
  },
  [CVA_TASK_ID]: {
    name: 'Written Vocabulary',
    nameSimple: 'CVA',
    nameTechnical: 'Rapid Online Assessment of Reading — Written Vocabulary',
  },
} as const satisfies Record<MultichoiceTask, { name: string; nameSimple: string; nameTechnical: string }>;

// ─── Seeding ──────────────────────────────────────────────────────────────────

async function seedTask(taskSlug: MultichoiceTask): Promise<{ id: string }> {
  const meta = TASK_METADATA[taskSlug];

  const [inserted] = await db
    .insert(tasks)
    .values({
      slug: taskSlug,
      name: meta.name,
      nameSimple: meta.nameSimple,
      nameTechnical: meta.nameTechnical,
      taskConfig: {},
    })
    .onConflictDoNothing()
    .returning();

  const task = inserted ?? (await db.query.tasks.findFirst({ where: eq(tasks.slug, taskSlug) }));
  if (!task) throw new Error(`Failed to insert or find task "${taskSlug}"`);

  if (inserted) {
    console.log(`  Inserted task "${taskSlug}": ${task.id}`);
  } else {
    console.log(`  Task "${taskSlug}" already exists (${task.id}), skipping.`);
  }

  return task;
}

async function seedVariant(taskId: string, def: VariantDef): Promise<void> {
  // Query-first: the unique index on task_variants is a functional partial index
  // (lower(name) WHERE name IS NOT NULL), which Drizzle cannot target in
  // onConflictDoNothing — so we check existence explicitly.
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

  // Collect unique task slugs to determine which tasks need to exist.
  const slugsNeeded = [...new Set(variantDefs.map((d) => d.taskSlug))];

  const tasksById = new Map<MultichoiceTask, { id: string }>();

  for (const slug of slugsNeeded) {
    console.log(`Seeding task "${slug}"...`);
    tasksById.set(slug, await seedTask(slug));
  }

  for (const def of variantDefs) {
    const task = tasksById.get(def.taskSlug)!;
    console.log(`\nSeeding variant "${def.variantName}" (task=${def.taskSlug})...`);
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
