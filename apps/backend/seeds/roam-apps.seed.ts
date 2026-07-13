/**
 * Seed script for ROAM tasks and variants.
 *
 * Reads variant definitions from the file at TASK_VARIANT_PARAMETERS_FILE (required).
 * The file is a JSON array where each entry has a variantName and a params object whose
 * keys match the gameParams accepted by roam-apps. The set of tasks to create is derived
 * from the unique (taskName, language) pairs present in the file.
 *
 * Unlike roar-levante-tasks, the task slug is language-suffixed (e.g. "fluency-arf-es")
 * because roam's scoring configs (fluency.json) key off language-suffixed task slugs.
 * The variant's own "taskName" param stays the base value (e.g. "fluency-arf") so the
 * bundle routes correctly via camelize(taskName) in taskConfig.js — only the DB task
 * row's slug carries the language suffix.
 *
 * Idempotent — tasks and variants that already exist by slug/name are skipped.
 *
 * Usage:
 *   TASK_VARIANT_PARAMETERS_FILE=./taskVariantParameters.json npm run db:seed:roam-apps -w apps/backend
 *
 * To get started, copy taskVariantParameters.example.json in the assessment directory:
 *   cp apps/assessments/roam-apps/taskVariantParameters.example.json \
 *      apps/assessments/roam-apps/taskVariantParameters.json
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
// Keyed by the base taskName (unsuffixed) — matches the variant's own "taskName" param.

const TASK_META: Record<string, { name: string; nameSimple: string; nameTechnical: string }> = {
  'fluency-arf': {
    name: 'Arithmetic Fluency',
    nameSimple: 'ARF',
    nameTechnical: 'ROAM Arithmetic Reasoning Fluency',
  },
  'fluency-calf': {
    name: 'Calculation Fluency',
    nameSimple: 'CALF',
    nameTechnical: 'ROAM Calculation Fluency',
  },
  'roam-alpaca': {
    name: 'Core Math',
    nameSimple: 'Core Math',
    nameTechnical: 'ROAM Alpaca Core Math',
  },
};

// Locale suffixes wired for seeding — 'es' and 'pt' are dashboard-supported alongside 'en'.
// 'it' is migrated in source but intentionally not seeded (see migration plan).
const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  pt: 'Portuguese',
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

function slugFor(taskName: string, language: string): string {
  return language === 'en' ? taskName : `${taskName}-${language}`;
}

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

    if (!('language' in p) || typeof p.language !== 'string') {
      throw new Error(`${loc}: "language" is required in params`);
    }

    if (p.language !== 'en' && !LANGUAGE_NAMES[p.language]) {
      throw new Error(
        `${loc}: unsupported language "${p.language}". Supported: en, ${Object.keys(LANGUAGE_NAMES).join(', ')}`,
      );
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

async function seedTask(slug: string, taskName: string, language: string): Promise<{ id: string }> {
  const meta = TASK_META[taskName]!;
  const languageName = LANGUAGE_NAMES[language];

  const [inserted] = await db
    .insert(tasks)
    .values({
      slug,
      name: languageName ? `${meta.name} (${languageName})` : meta.name,
      nameSimple: meta.nameSimple,
      nameTechnical: meta.nameTechnical,
      taskConfig: {},
    })
    .onConflictDoNothing({ target: tasks.slug })
    .returning();

  const task = inserted ?? (await db.query.tasks.findFirst({ where: eq(tasks.slug, slug) }));
  if (!task) throw new Error(`Failed to insert or find task "${slug}"`);

  if (inserted) {
    console.log(`  Inserted task "${slug}": ${task.id}`);
  } else {
    console.log(`  Task "${slug}" already exists (${task.id}), skipping.`);
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

  const slugsNeeded = new Map<string, { taskName: string; language: string }>();
  for (const def of variantDefs) {
    const taskName = def.params.taskName as string;
    const language = def.params.language as string;
    slugsNeeded.set(slugFor(taskName, language), { taskName, language });
  }

  const tasksBySlug = new Map<string, { id: string }>();
  for (const [slug, { taskName, language }] of slugsNeeded) {
    console.log(`Seeding task "${slug}"...`);
    tasksBySlug.set(slug, await seedTask(slug, taskName, language));
  }

  for (const def of variantDefs) {
    const taskName = def.params.taskName as string;
    const language = def.params.language as string;
    const slug = slugFor(taskName, language);
    const task = tasksBySlug.get(slug)!;
    console.log(`\nSeeding variant "${def.variantName}" (slug=${slug})...`);
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
