/**
 * Unified task/variant seed script for all assessments.
 *
 * Seeds a single assessment's task(s) and variants from a taskVariantParameters.json
 * file. Replaces the per-assessment seed scripts (roar-pa.seed.ts, roar-swr.seed.ts, etc.)
 * with a single entrypoint driven by a task config registry.
 *
 * Usage:
 *   npm run dev:seed:tasks -- --task roar-pa
 *   TASK_VARIANT_PARAMETERS_FILE=./params.json npm run dev:seed:tasks -- --task roar-swr
 *
 * The --task argument selects a config from the registry which provides:
 * - Task ID(s) and metadata (name, nameSimple, nameTechnical)
 * - Allowed parameter keys for validation
 * - Optional custom validation function
 *
 * Idempotent — tasks and variants that already exist are skipped.
 *
 * Environment variables:
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - TASK_VARIANT_PARAMETERS_FILE: Path to the parameters JSON file (required)
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';

import * as CoreDbSchema from '../src/db/schema/core';
import { tasks, taskVariants, taskVariantParameters } from '../src/db/schema/core';
import { TASK_SEED_CONFIGS } from './task-seed-configs';

import type { TaskSeedConfig, VariantDef } from './task-seed-configs';

// ─── CLI arguments ───────────────────────────────────────────────────────────

const taskArg = process.argv.find((_, i, arr) => arr[i - 1] === '--task');
if (!taskArg) {
  const available = Object.keys(TASK_SEED_CONFIGS).join(', ');
  console.error(`Usage: npm run dev:seed:tasks -- --task <name>\nAvailable tasks: ${available}`);
  process.exit(1);
}

const config: TaskSeedConfig | undefined = TASK_SEED_CONFIGS[taskArg];
if (!config) {
  const available = Object.keys(TASK_SEED_CONFIGS).join(', ');
  console.error(`Unknown task "${taskArg}". Available tasks: ${available}`);
  process.exit(1);
}

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

// ─── Validation ──────────────────────────────────────────────────────────────

function validateVariants(raw: unknown): VariantDef[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('taskVariantParameters.json must be a non-empty array');
  }

  const result: VariantDef[] = [];

  for (let i = 0; i < raw.length; i++) {
    const entry: unknown = raw[i];
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

    // Validate allowed parameter keys if the config defines them
    if (config.allowedParamKeys) {
      for (const key of Object.keys(p)) {
        if (!config.allowedParamKeys.has(key)) {
          throw new Error(`${loc}: unknown param "${key}"`);
        }
      }
    }

    // Run custom validation if provided. Return false to skip the variant.
    if (config.validateVariant) {
      const shouldInclude = config.validateVariant(loc, p);
      if (shouldInclude === false) {
        console.log(`  Skipping ${loc}: validateVariant returned false`);
        continue;
      }
    }

    result.push({ variantName: name, params: p });
  }

  return result;
}

// ─── Load and validate file ──────────────────────────────────────────────────

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

// ─── Database ────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: CORE_DATABASE_URL });
const db = drizzle(pool, { schema: CoreDbSchema, casing: 'snake_case' });

// ─── Seeding ─────────────────────────────────────────────────────────────────

async function seedTask(taskId: string, meta: TaskSeedConfig['tasks'][string]): Promise<{ id: string }> {
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

async function seedVariant(taskDbId: string, def: VariantDef): Promise<void> {
  // Query-first: the unique index on task_variants is a functional partial index
  // (lower(name) WHERE name IS NOT NULL), which Drizzle cannot target in
  // onConflictDoNothing — so we check existence explicitly.
  const existing = await db.query.taskVariants.findFirst({
    where: and(eq(taskVariants.taskId, taskDbId), eq(taskVariants.name, def.variantName)),
  });

  if (existing) {
    console.log(`Variant "${def.variantName}" already exists (${existing.id}), skipping.`);
    return;
  }

  const [variant] = await db
    .insert(taskVariants)
    .values({ taskId: taskDbId, name: def.variantName, status: 'published' })
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

    console.log(`  Inserted ${paramEntries.length} parameter(s) for "${def.variantName}"`);
  }
}

async function seed(): Promise<void> {
  console.log(`Reading variants from ${TASK_VARIANT_PARAMETERS_FILE}`);
  console.log(`Found ${variantDefs.length} variant(s) to seed.\n`);

  // Determine which task(s) need seeding.
  // Multi-task configs (e.g., roav-apps) resolve taskId from variant params via resolveTaskId.
  // Single-task configs have exactly one entry in config.tasks.
  const taskIds = config.resolveTaskId
    ? [...new Set(variantDefs.map((d) => config.resolveTaskId!(d.params)))]
    : Object.keys(config.tasks);

  const tasksById = new Map<string, { id: string }>();
  for (const taskId of taskIds) {
    const meta = config.tasks[taskId];
    if (!meta) {
      throw new Error(`No task metadata found for "${taskId}" in config "${taskArg}"`);
    }
    console.log(`Seeding task "${taskId}"...`);
    tasksById.set(taskId, await seedTask(taskId, meta));
  }

  for (const def of variantDefs) {
    const taskId = config.resolveTaskId ? config.resolveTaskId(def.params) : taskIds[0]!;
    const task = tasksById.get(taskId)!;
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
