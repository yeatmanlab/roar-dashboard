/**
 * Seed script for the ROAR Survey task and its default variant.
 *
 * Survey content is dynamic — determined at runtime by a GCS file name stored
 * in variant params — so no fixed variant kinds are enumerated here. This script
 * inserts a single `roar-survey` task and a single default variant named "default".
 *
 * Idempotent — the task and variant are skipped if they already exist.
 *
 * Usage:
 *   npm run db:seed:roar-survey -w apps/backend
 *
 * Requires CORE_DATABASE_URL to be set.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { Pool } from 'pg';
import { survey } from '@roar-platform/assessment-schema';
import * as CoreDbSchema from '../src/db/schema/core';
import { tasks, taskVariants } from '../src/db/schema/core';

const { SURVEY_TASK_ID } = survey;

// ─── Environment ─────────────────────────────────────────────────────────────

const CORE_DATABASE_URL = process.env.CORE_DATABASE_URL;
if (!CORE_DATABASE_URL) throw new Error('CORE_DATABASE_URL is required');

// ─── Database ─────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: CORE_DATABASE_URL });
const db = drizzle(pool, { schema: CoreDbSchema, casing: 'snake_case' });

// ─── Seeding ──────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
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

  console.log(`\nSeeding default variant...`);

  const existing = await db.query.taskVariants.findFirst({
    where: and(eq(taskVariants.taskId, task.id), eq(taskVariants.name, 'default')),
  });

  if (existing) {
    console.log(`  Variant "default" already exists (${existing.id}), skipping.`);
  } else {
    const [variant] = await db
      .insert(taskVariants)
      .values({ taskId: task.id, name: 'default', status: 'published' })
      .returning();

    if (!variant) throw new Error('Failed to insert default variant');
    console.log(`  Inserted variant "default": ${variant.id}`);
  }

  console.log('\nSeeding complete.');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
