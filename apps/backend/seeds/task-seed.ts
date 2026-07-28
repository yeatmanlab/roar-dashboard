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
import { administrations, tasks, taskVariants, taskVariantParameters } from '../src/db/schema/core';
import { DEV_IDS } from './fixture-ids';
import { TASK_SEED_CONFIGS } from './task-seed-configs';
import { assignTaskVariant } from './utils/assign-task-variant';

import type { TaskSeedConfig, VariantDef } from './task-seed-configs';

// ─── CLI arguments ───────────────────────────────────────────────────────────

const taskArg = process.argv.find((_, i, arr) => arr[i - 1] === '--task');
if (!taskArg) {
  const available = Object.keys(TASK_SEED_CONFIGS).join(', ');
  console.error(`Usage: npm run dev:seed:tasks -- --task <name>\nAvailable tasks: ${available}`);
  process.exit(1);
}

/**
 * Skips assigning the config's `defaultVariant` to the launch sandbox administration.
 * The assignment is what makes the assessment launchable from the dashboard, so it
 * is on by default; opt out when seeding variants into a database whose
 * administrations you manage yourself.
 */
const skipAssignment = process.argv.includes('--no-assign');

/**
 * Re-sync parameters for variants that already exist.
 *
 * Seeding is otherwise skip-if-present, so editing `taskVariantParameters.json` and
 * re-running has no effect — which makes iterating on a variant's parameters
 * impossible without deleting the row by hand. This replaces the stored parameters
 * with what the file now says, leaving the variant (and any runs referencing it)
 * in place.
 */
const refreshParams = process.argv.includes('--refresh-params');

// Resolved via a function so `config` is typed non-optional — narrowing on a
// module-level binding doesn't propagate into the functions below.
function resolveConfig(name: string): TaskSeedConfig {
  const resolved = TASK_SEED_CONFIGS[name];
  if (!resolved) {
    const available = Object.keys(TASK_SEED_CONFIGS).join(', ');
    console.error(`Unknown task "${name}". Available tasks: ${available}`);
    process.exit(1);
  }
  return resolved;
}

const config: TaskSeedConfig = resolveConfig(taskArg);

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

/**
 * Insert a task, or bring an existing one back in line with its config.
 *
 * Task metadata is entirely config-derived, so the config is authoritative: a row
 * seeded before a field was added (`image`, say) would otherwise keep its stale
 * values forever, because a plain `onConflictDoNothing` can only ever create.
 * Variants are deliberately not treated this way — they carry participant runs, so
 * changing them is opt-in via `--refresh-params`.
 *
 * @param taskId - Task slug
 * @param meta - Task metadata from the seed config
 * @returns The task row
 */
async function seedTask(taskId: string, meta: TaskSeedConfig['tasks'][string]): Promise<{ id: string }> {
  const metadata = {
    name: meta.name,
    nameSimple: meta.nameSimple,
    nameTechnical: meta.nameTechnical,
    ...(meta.image ? { image: meta.image } : {}),
  };

  const existing = await db.query.tasks.findFirst({ where: eq(tasks.slug, taskId) });

  if (!existing) {
    const [inserted] = await db
      .insert(tasks)
      .values({ slug: taskId, ...metadata, taskConfig: {} })
      .returning();

    if (!inserted) throw new Error(`Failed to insert task "${taskId}"`);

    console.log(`  Inserted task "${taskId}": ${inserted.id}`);
    return inserted;
  }

  const stale = Object.entries(metadata).filter(([key, value]) => existing[key as keyof typeof existing] !== value);

  if (stale.length === 0) {
    console.log(`  Task "${taskId}" already exists (${existing.id}), skipping.`);
    return existing;
  }

  await db.update(tasks).set(metadata).where(eq(tasks.slug, taskId));
  console.log(`  Task "${taskId}" (${existing.id}) updated: ${stale.map(([key]) => key).join(', ')}`);

  return existing;
}

async function seedVariant(taskDbId: string, def: VariantDef): Promise<{ id: string }> {
  // Query-first: the unique index on task_variants is a functional partial index
  // (lower(name) WHERE name IS NOT NULL), which Drizzle cannot target in
  // onConflictDoNothing — so we check existence explicitly.
  const existing = await db.query.taskVariants.findFirst({
    where: and(eq(taskVariants.taskId, taskDbId), eq(taskVariants.name, def.variantName)),
  });

  if (existing) {
    if (refreshParams) {
      await writeVariantParameters(existing.id, def, { replace: true });
      console.log(`Variant "${def.variantName}" already exists (${existing.id}), parameters refreshed.`);
    } else {
      console.log(`Variant "${def.variantName}" already exists (${existing.id}), skipping.`);
    }
    return existing;
  }

  const [variant] = await db
    .insert(taskVariants)
    .values({ taskId: taskDbId, name: def.variantName, status: 'published' })
    .returning();

  if (!variant) throw new Error(`Failed to insert variant "${def.variantName}"`);

  console.log(`  Inserted variant "${def.variantName}": ${variant.id}`);

  await writeVariantParameters(variant.id, def, { replace: false });

  return variant;
}

/**
 * Write a variant's parameters.
 *
 * @param variantId - The variant to write parameters for
 * @param def - Variant definition supplying the parameter values
 * @param options.replace - Delete existing parameters first, so removed keys disappear
 *   rather than lingering. Used by `--refresh-params`; a plain insert can only add.
 */
async function writeVariantParameters(
  variantId: string,
  def: VariantDef,
  { replace }: { replace: boolean },
): Promise<void> {
  // Omit null/undefined params — only store params with explicit values.
  const paramEntries = Object.entries(def.params).filter(([, v]) => v !== null && v !== undefined);

  if (replace) {
    await db.delete(taskVariantParameters).where(eq(taskVariantParameters.taskVariantId, variantId));
  }

  if (paramEntries.length === 0) return;

  await db
    .insert(taskVariantParameters)
    .values(paramEntries.map(([name, value]) => ({ taskVariantId: variantId, name, value })))
    .onConflictDoNothing({ target: [taskVariantParameters.taskVariantId, taskVariantParameters.name] });

  console.log(`  ${replace ? 'Replaced' : 'Inserted'} ${paramEntries.length} parameter(s) for "${def.variantName}"`);
}

/**
 * Assign a seeded variant to the dev fixture's launch-sandbox administration, which
 * is what makes the assessment launchable from the dashboard as a fixture student.
 *
 * The sandbox exists so this seed never mixes real tasks into the administrations
 * that carry synthetic `TaskFactory` tasks — those drive the progress and score
 * fixtures and must keep their shape.
 *
 * No-ops when that administration is absent. That is the normal case for the
 * assessment e2e stack, which runs migrations and this seed but never seeds the dev
 * fixture (`docker-compose.assessment.yml`), and for any database whose
 * administrations are managed elsewhere.
 *
 * Idempotent: the junction's primary key is (administration_id, task_variant_id).
 *
 * @param variantId - The seeded task variant to assign
 * @param variantName - Variant name, for logging
 */
async function assignToFixtureAdministration(variantId: string, variantName: string): Promise<void> {
  const administrationId = DEV_IDS.administrationLaunch;

  const administration = await db.query.administrations.findFirst({
    where: eq(administrations.id, administrationId),
    columns: { id: true },
  });

  if (!administration) {
    console.log(`\nLaunch sandbox administration not found — skipping assignment of "${variantName}".`);
    console.log('  (expected when the dev fixture has not been seeded, e.g. the assessment e2e stack)');
    return;
  }

  const orderIndex = await assignTaskVariant(db, administrationId, variantId);

  if (orderIndex === null) {
    console.log(`\nVariant "${variantName}" is already assigned to the launch sandbox administration, skipping.`);
    return;
  }

  console.log(`\nAssigned "${variantName}" to the launch sandbox administration (order ${orderIndex}).`);
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

  const variantIdsByName = new Map<string, string>();

  for (const def of variantDefs) {
    const taskId = config.resolveTaskId ? config.resolveTaskId(def.params) : taskIds[0]!;
    const task = tasksById.get(taskId)!;
    console.log(`\nSeeding variant "${def.variantName}"...`);
    const variant = await seedVariant(task.id, def);
    variantIdsByName.set(def.variantName, variant.id);
  }

  if (config.defaultVariant && !skipAssignment) {
    const variantId = variantIdsByName.get(config.defaultVariant);

    if (variantId) {
      await assignToFixtureAdministration(variantId, config.defaultVariant);
    } else {
      // A defaultVariant naming a variant this run didn't seed means the config and
      // the parameters file have drifted apart — surface it rather than silently
      // leaving the assessment unlaunchable.
      console.warn(
        `\nConfig "${taskArg}" names defaultVariant "${config.defaultVariant}", ` +
          'which is not in the parameters file — skipping assignment.',
      );
    }
  }

  console.log('\nSeeding complete.');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
