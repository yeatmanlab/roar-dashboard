/**
 * Seed script for ROAR Letter and Phonics tasks and variants.
 *
 * Reads variant definitions from the file at TASK_VARIANT_PARAMETERS_FILE (required).
 * The file is a JSON array where each entry has a variantName and a params object.
 *
 * Two task families are supported, distinguished by the required "task" param:
 *   - Letter variants: params.task === "letter" — require params.lng for routing to the
 *     correct language-specific backend task (letter-en, letter-es, letter-en-ca)
 *   - Phonics variants: params.task === "phonics" — always seeded under PHONICS_TASK_IDS.EN
 *
 * All params (including "task" and "lng") are stored as task variant parameters.
 *
 * Idempotent — tasks and variants that already exist by slug / name are skipped.
 *
 * Usage:
 *   TASK_VARIANT_PARAMETERS_FILE=./taskVariantParameters.json npm run db:seed:roar-letter -w apps/backend
 *
 * To get started, copy taskVariantParameters.example.json in the assessment directory:
 *   cp apps/assessments/roar-letter/taskVariantParameters.example.json \
 *      apps/assessments/roar-letter/taskVariantParameters.json
 *
 * Requires CORE_DATABASE_URL and TASK_VARIANT_PARAMETERS_FILE to be set.
 */

import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { letter } from '@roar-platform/assessment-schema';
import * as CoreDbSchema from '../src/db/schema/core';
import { tasks, taskVariants, taskVariantParameters } from '../src/db/schema/core';

const { LETTER_LANGUAGES, LETTER_SCORING_VERSION, PHONICS_TASK_IDS } = letter;

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

type LetterLng = keyof typeof LETTER_LANGUAGES;

type VariantDef = {
  variantName: string;
  params: Record<string, unknown>;
  /** Resolved task slug — determined during validation */
  taskSlug: string;
};

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_LNG = new Set(Object.keys(LETTER_LANGUAGES));
const VALID_SCORING_VERSIONS = new Set<unknown>(Object.values(LETTER_SCORING_VERSION));
const VALID_TASK_VALUES = new Set(['letter', 'phonics']);

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
      throw new Error(`${loc}: "params.task" must be "letter" or "phonics"`);
    }

    let taskSlug: string;

    if (p.task === 'letter') {
      if (typeof p.lng !== 'string') {
        throw new Error(`${loc}: letter variants require "params.lng"`);
      }

      // Skip entries for unsupported languages (e.g., Italian stub entries)
      if (!VALID_LNG.has(p.lng)) {
        console.log(`  Skipping ${loc}: "lng" "${p.lng}" is not a supported language — entry ignored.`);
        continue;
      }

      if ('scoringVersion' in p && p.scoringVersion !== null) {
        if (!VALID_SCORING_VERSIONS.has(p.scoringVersion)) {
          throw new Error(`${loc}: "scoringVersion" must be one of ${[...VALID_SCORING_VERSIONS].join(', ')} or null`);
        }
      }

      taskSlug = LETTER_LANGUAGES[p.lng as LetterLng].taskId;
    } else {
      // phonics
      taskSlug = PHONICS_TASK_IDS.EN;
    }

    results.push({ variantName: name, params: p, taskSlug });
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

// ─── Seeding ──────────────────────────────────────────────────────────────────

async function seedLetterTask(lng: LetterLng): Promise<{ id: string }> {
  const lang = LETTER_LANGUAGES[lng];
  const isEnglish = lng === 'en';
  const languageSuffix = isEnglish ? '' : ` (${lang.label})`;

  const [inserted] = await db
    .insert(tasks)
    .values({
      slug: lang.taskId,
      name: `Letter${languageSuffix}`,
      nameSimple: `Letter${isEnglish ? '' : `-${lang.code.toUpperCase()}`}`,
      nameTechnical: `Rapid Online Assessment of Reading — Letter${languageSuffix}`,
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

async function seedPhonicsTask(): Promise<{ id: string }> {
  const taskId = PHONICS_TASK_IDS.EN;

  const [inserted] = await db
    .insert(tasks)
    .values({
      slug: taskId,
      name: 'Phonics',
      nameSimple: 'Phonics',
      nameTechnical: 'Rapid Online Assessment of Reading — Phonics',
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

  // Collect unique task slugs to determine which tasks need to exist.
  const slugsNeeded = [...new Set(variantDefs.map((d) => d.taskSlug))];

  const tasksById = new Map<string, { id: string }>();

  for (const slug of slugsNeeded) {
    if (slug === PHONICS_TASK_IDS.EN) {
      console.log(`Seeding phonics task...`);
      tasksById.set(slug, await seedPhonicsTask());
    } else {
      // Find the lng that maps to this slug
      const lng = Object.keys(LETTER_LANGUAGES).find(
        (k) => LETTER_LANGUAGES[k as LetterLng].taskId === slug,
      ) as LetterLng;
      console.log(`Seeding letter task for lng="${lng}"...`);
      tasksById.set(slug, await seedLetterTask(lng));
    }
  }

  for (const def of variantDefs) {
    const task = tasksById.get(def.taskSlug)!;
    console.log(`\nSeeding variant "${def.variantName}" (taskSlug=${def.taskSlug})...`);
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
