/**
 * Seed script for ROAR LEVANTE tasks and variants.
 *
 * Reads variant definitions from the file at TASK_VARIANT_PARAMETERS_FILE (required).
 * The file is a JSON array where each entry has a variantName and a params object whose
 * keys match the gameParams accepted by roar-levante-tasks. The set of tasks to create
 * is derived from the unique taskName values present in the file.
 *
 * Idempotent — tasks and variants that already exist by slug/name are skipped.
 *
 * Usage:
 *   TASK_VARIANT_PARAMETERS_FILE=./taskVariantParameters.json npm run db:seed:roar-levante-tasks -w apps/backend
 *
 * To get started, copy taskVariantParameters.example.json in the assessment directory:
 *   cp apps/assessments/roar-levante-tasks/taskVariantParameters.example.json \
 *      apps/assessments/roar-levante-tasks/taskVariantParameters.json
 *
 * Requires CORE_DATABASE_URL and TASK_VARIANT_PARAMETERS_FILE to be set.
 */

import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import * as CoreDbSchema from '../src/db/schema/core';
import { tasks, taskVariants, taskVariantParameters } from '../src/db/schema/core';

// ─── Task metadata ────────────────────────────────────────────────────────────

const TASK_META: Record<string, { name: string; nameSimple: string; nameTechnical: string }> = {
  trog: {
    name: 'TROG (Syntax)',
    nameSimple: 'TROG',
    nameTechnical: 'Test for Reception of Grammar — ROAR Edition',
  },
  'roar-inference': {
    name: 'ROAR Inference',
    nameSimple: 'Inference',
    nameTechnical: 'Rapid Online Assessment of Reading — Inference',
  },
  'egma-math': {
    name: 'EGMA Math',
    nameSimple: 'Math',
    nameTechnical: 'Early Grade Mathematics Assessment',
  },
  'matrix-reasoning': {
    name: 'Matrix Reasoning',
    nameSimple: 'Matrix Reasoning',
    nameTechnical: 'LEVANTE Matrix Reasoning',
  },
  'mental-rotation': {
    name: 'Mental Rotation',
    nameSimple: 'Mental Rotation',
    nameTechnical: 'LEVANTE Mental Rotation',
  },
  'same-different-selection': {
    name: 'Same-Different Selection',
    nameSimple: 'SDS',
    nameTechnical: 'LEVANTE Same-Different Selection',
  },
  'theory-of-mind': {
    name: 'Theory of Mind',
    nameSimple: 'ToM',
    nameTechnical: 'LEVANTE Theory of Mind',
  },
  'adult-reasoning': {
    name: 'Adult Reasoning',
    nameSimple: 'Adult Reasoning',
    nameTechnical: 'LEVANTE Adult Reasoning',
  },
  vocab: {
    name: 'Vocabulary',
    nameSimple: 'Vocab',
    nameTechnical: 'LEVANTE Vocabulary Assessment',
  },
  'hearts-and-flowers': {
    name: 'Hearts & Flowers',
    nameSimple: 'H&F',
    nameTechnical: 'LEVANTE Hearts and Flowers',
  },
  'memory-game': {
    name: 'Memory Game',
    nameSimple: 'Memory',
    nameTechnical: 'LEVANTE Memory Game',
  },
  intro: {
    name: 'Intro',
    nameSimple: 'Intro',
    nameTechnical: 'LEVANTE Intro',
  },
};

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

    if (!('taskName' in p) || typeof p.taskName !== 'string') {
      throw new Error(`${loc}: "taskName" is required in params`);
    }

    if (!TASK_META[p.taskName]) {
      throw new Error(`${loc}: unknown taskName "${p.taskName}". Known tasks: ${Object.keys(TASK_META).join(', ')}`);
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

async function seedTask(taskId: string): Promise<{ id: string }> {
  const meta = TASK_META[taskId]!;

  const [inserted] = await db
    .insert(tasks)
    .values({
      slug: taskId,
      name: meta.name,
      nameSimple: meta.nameSimple,
      nameTechnical: meta.nameTechnical,
      taskConfig: {},
    })
    .onConflictDoNothing()
    .returning();

  const task = inserted ?? (await db.query.tasks.findFirst({ where: eq(tasks.slug, taskId) }));
  if (!task) throw new Error(`Failed to insert or find task "${taskId}"`);

  if (inserted) {
    console.log(`  Inserted task "${taskId}": ${task.id}`);
  } else {
    console.log(`  Task "${taskId}" already exists (${task.id}), skipping.`);
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

  const taskIdsNeeded = [...new Set(variantDefs.map((d) => d.params.taskName as string))];

  const tasksById = new Map<string, { id: string }>();
  for (const taskId of taskIdsNeeded) {
    console.log(`Seeding task "${taskId}"...`);
    tasksById.set(taskId, await seedTask(taskId));
  }

  for (const def of variantDefs) {
    const taskId = def.params.taskName as string;
    const task = tasksById.get(taskId)!;
    console.log(`\nSeeding variant "${def.variantName}" (taskName=${taskId})...`);
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
