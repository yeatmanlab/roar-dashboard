/**
 * Seed script for the ROAR Phonological Awareness (PA) task and its default variants.
 *
 * Seeds the `tasks`, `task_variants`, and `task_variant_parameters` tables with the
 * PA task definition and two default variants (English fixed-form and English adaptive).
 *
 * Idempotent — safe to run multiple times. Existing records are left unchanged.
 *
 * Usage:
 *   npm run db:seed:pa -w apps/backend
 *
 * Requires CORE_DATABASE_URL to be set in the environment.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { pa } from '@roar-dashboard/assessment-schema';
import * as CoreDbSchema from '../src/db/schema/core';
import { tasks, taskVariants, taskVariantParameters } from '../src/db/schema/core';

const { PA_TASK_ID } = pa;

const CORE_DATABASE_URL = process.env.CORE_DATABASE_URL;
if (!CORE_DATABASE_URL) throw new Error('CORE_DATABASE_URL is required');

const pool = new Pool({ connectionString: CORE_DATABASE_URL });
const db = drizzle(pool, { schema: CoreDbSchema, casing: 'snake_case' });

const DEFAULT_VARIANTS = [
  {
    name: 'English Fixed',
    description: 'Standard English fixed-form assessment',
    params: {
      language: 'en',
      isAdaptive: false,
      itemSelect: 'fixed',
    },
  },
  {
    name: 'English Adaptive',
    description: 'English adaptive (IRT-based) assessment',
    params: {
      language: 'en',
      isAdaptive: true,
      itemSelect: 'mfi',
    },
  },
] as const;

async function seed() {
  console.log('Seeding PA task...');

  const [inserted] = await db
    .insert(tasks)
    .values({
      slug: PA_TASK_ID,
      name: 'Phonological Awareness',
      nameSimple: 'Phonological Awareness',
      nameTechnical: 'Rapid Online Assessment of Reading — Phonological Awareness',
      description:
        'Measures phonological awareness skills including first sound matching, last sound matching, and phoneme deletion.',
      taskConfig: {},
    })
    .onConflictDoNothing()
    .returning();

  const task = inserted ?? (await db.query.tasks.findFirst({ where: eq(tasks.slug, PA_TASK_ID) }));

  if (!task) throw new Error('Failed to insert or find PA task');

  if (inserted) {
    console.log(`Inserted PA task: ${task.id}`);
  } else {
    console.log(`PA task already exists (${task.id}), skipping insert.`);
  }

  for (const { name, description, params } of DEFAULT_VARIANTS) {
    const [variant] = await db
      .insert(taskVariants)
      .values({
        taskId: task.id,
        name,
        description,
        status: 'published',
      })
      .onConflictDoNothing()
      .returning();

    if (!variant) {
      console.log(`Variant "${name}" already exists, skipping.`);
      continue;
    }

    console.log(`Inserted variant "${name}": ${variant.id}`);

    await db
      .insert(taskVariantParameters)
      .values(
        Object.entries(params).map(([paramName, value]) => ({
          taskVariantId: variant.id,
          name: paramName,
          value,
        })),
      )
      .onConflictDoNothing();

    console.log(`Inserted ${Object.keys(params).length} parameters for "${name}"`);
  }

  console.log('Seeding complete.');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
