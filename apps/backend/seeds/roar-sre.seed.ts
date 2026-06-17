/**
 * Seed script for ROAR SRE tasks and variants.
 *
 * Reads variant definitions from the file at TASK_VARIANT_PARAMETERS_FILE (required).
 * The file is a JSON array where each entry has a variantName and a params object whose
 * keys match the gameParams in roar-sre's serve.js. The set of tasks to create is derived
 * from the unique lng values present in the file — no separate task config is needed.
 *
 * Idempotent — variants that already exist by name are skipped.
 *
 * Usage:
 *   TASK_VARIANT_PARAMETERS_FILE=./taskVariantParameters.json npm run db:seed:roar-sre -w apps/backend
 *
 * To get started, copy taskVariantParameters.example.json in the assessment directory:
 *   cp apps/assessments/roar-sre/taskVariantParameters.example.json \
 *      apps/assessments/roar-sre/taskVariantParameters.json
 *
 * Requires CORE_DATABASE_URL and TASK_VARIANT_PARAMETERS_FILE to be set.
 */

import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { sre } from '@roar-platform/assessment-schema';
import * as CoreDbSchema from '../src/db/schema/core';
import { tasks, taskVariants, taskVariantParameters } from '../src/db/schema/core';

const { SRE_LANGUAGES, SRE_SCORING_VERSION } = sre;

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

type SreLng = keyof typeof SRE_LANGUAGES;

type VariantDef = {
  variantName: string;
  params: Record<string, unknown>;
};

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_LNG = new Set(Object.keys(SRE_LANGUAGES));
const VALID_SCORING_VERSIONS = new Set<unknown>(Object.values(SRE_SCORING_VERSION));

// Derived from parameters.json — all keys that serve.js passes as gameParams.
const ALLOWED_PARAM_KEYS = new Set([
  'consent',
  'lng',
  'recruitment',
  'scoringVersion',
  'skipInstructions',
  'storyOption',
  'timerLength',
  'userMode',
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

    if (!('lng' in p)) {
      throw new Error(`${loc}: "lng" is required`);
    }
    if (!VALID_LNG.has(p.lng as string)) {
      throw new Error(`${loc}: "lng" must be one of ${[...VALID_LNG].join(', ')}`);
    }

    if ('scoringVersion' in p && p.scoringVersion !== null) {
      if (!VALID_SCORING_VERSIONS.has(p.scoringVersion)) {
        throw new Error(`${loc}: "scoringVersion" must be one of ${[...VALID_SCORING_VERSIONS].join(', ')} or null`);
      }
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

async function seedTask(lng: SreLng): Promise<{ id: string }> {
  const lang = SRE_LANGUAGES[lng];
  const isEnglish = lng === 'en';
  const languageSuffix = isEnglish ? '' : ` (${lang.label})`;

  const [inserted] = await db
    .insert(tasks)
    .values({
      slug: lang.taskId,
      name: `Sentence Reading Efficiency${languageSuffix}`,
      nameSimple: `SRE${isEnglish ? '' : `-${lang.code.toUpperCase()}`}`,
      nameTechnical: `Rapid Online Assessment of Reading — Sentence Reading Efficiency${languageSuffix}`,
      taskConfig: {},
    })
    .onConflictDoNothing()
    .returning();

  const task = inserted ?? (await db.query.tasks.findFirst({ where: eq(tasks.slug, lang.taskId) }));
  if (!task) throw new Error(`Failed to insert or find task "${lang.taskId}"`);

  if (inserted) {
    console.log(`  Inserted task "${lang.taskId}": ${task.id}`);
  } else {
    console.log(`  Task "${lang.taskId}" already exists (${task.id}), skipping.`);
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

  // Collect unique lng values to determine which tasks need to exist.
  // Italian is excluded — translation is not yet complete and there is no task to seed.
  const lngsNeeded = [...new Set(variantDefs.map((d) => d.params.lng as SreLng))].filter((lng) => lng in SRE_LANGUAGES);

  const tasksByLng = new Map<SreLng, { id: string }>();
  for (const lng of lngsNeeded) {
    console.log(`Seeding task for lng="${lng}"...`);
    tasksByLng.set(lng, await seedTask(lng));
  }

  for (const def of variantDefs) {
    const lng = def.params.lng as SreLng;
    // Skip variants for languages not in SRE_LANGUAGES (e.g., Italian stubs).
    if (!tasksByLng.has(lng)) {
      console.log(`\nSkipping variant "${def.variantName}" — lng="${lng}" has no task.`);
      continue;
    }
    const task = tasksByLng.get(lng)!;
    console.log(`\nSeeding variant "${def.variantName}" (lng=${lng})...`);
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
