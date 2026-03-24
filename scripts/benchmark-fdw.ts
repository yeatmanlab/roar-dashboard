#!/usr/bin/env tsx
/**
 * FDW Performance Benchmark: Views vs Direct Foreign Tables
 *
 * Measures whether switching from FDW views (which filter soft-deleted rows on the
 * assessment DB side) to direct foreign tables (with soft-delete filtering on the
 * core DB side) improves query performance.
 *
 * Prerequisites:
 *   ./scripts/setup-fdw-local.sh
 *   npm run db:migrate -w apps/backend
 *
 * Usage:
 *   npx tsx scripts/benchmark-fdw.ts                  # medium scale (default)
 *   npx tsx scripts/benchmark-fdw.ts --scale small
 *   npx tsx scripts/benchmark-fdw.ts --scale large
 *   npx tsx scripts/benchmark-fdw.ts --no-cleanup      # keep test data for manual inspection
 */

import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

type Scale = 'small' | 'medium' | 'large';

const args = process.argv.slice(2);
const scaleArg = args.find((a) => a.startsWith('--scale'))
  ? args[args.indexOf('--scale') + 1]
  : 'medium';
const noCleanup = args.includes('--no-cleanup');
const scale: Scale = ['small', 'medium', 'large'].includes(scaleArg!)
  ? (scaleArg as Scale)
  : 'medium';

const SCALE_CONFIG = {
  small: { students: 200, runsPerStudent: 100, scoresPerRun: 3.75, deletedPct: 0.05 },
  medium: { students: 1_000, runsPerStudent: 100, scoresPerRun: 3.75, deletedPct: 0.05 },
  large: { students: 5_000, runsPerStudent: 100, scoresPerRun: 3.75, deletedPct: 0.05 },
} as const;

const config = SCALE_CONFIG[scale];
const totalRuns = config.students * config.runsPerStudent;
const totalScores = Math.round(totalRuns * config.scoresPerRun);
const deletedRuns = Math.round(totalRuns * config.deletedPct);

console.log(`\n=== FDW Benchmark (${scale}) ===`);
console.log(
  `Students: ${config.students} | Runs: ${totalRuns.toLocaleString()} | Scores: ${totalScores.toLocaleString()} | Deleted: ${deletedRuns.toLocaleString()}\n`,
);

// ---------------------------------------------------------------------------
// DB connections
// ---------------------------------------------------------------------------

const corePool = new Pool({
  host: process.env.PG_HOST ?? 'localhost',
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER ?? 'postgres',
  database: process.env.CORE_DB ?? 'roar_core',
});

const assessmentPool = new Pool({
  host: process.env.PG_HOST ?? 'localhost',
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER ?? 'postgres',
  database: process.env.ASSESSMENT_DB ?? 'roar_assessment',
});

// ---------------------------------------------------------------------------
// Constants for seeded data
// ---------------------------------------------------------------------------

const BENCHMARK_TAG = 'fdw-benchmark';
const ADMINISTRATION_IDS = Array.from({ length: 5 }, () => randomUUID());
const TASK_IDS = Array.from({ length: 10 }, () => randomUUID());
const TASK_VARIANT_IDS = Array.from({ length: 20 }, () => randomUUID());
const SCORE_DOMAINS = ['phonics', 'vocabulary', 'fluency', 'comprehension', 'math'];
const SCORE_NAMES = ['theta', 'se', 'percentile', 'raw_score'];
const SCORE_TYPES = ['computed', 'raw'] as const;
const ASSESSMENT_STAGES = ['practice', 'test'] as const;

// ---------------------------------------------------------------------------
// Setup: create direct foreign tables
// ---------------------------------------------------------------------------

async function setupDirectForeignTables(): Promise<void> {
  console.log('Setting up direct foreign tables...');
  await corePool.query(`
    CREATE SCHEMA IF NOT EXISTS app_assessment_fdw_direct;

    DROP FOREIGN TABLE IF EXISTS app_assessment_fdw_direct.runs;
    CREATE FOREIGN TABLE app_assessment_fdw_direct.runs (
      id uuid NOT NULL,
      user_id uuid NOT NULL,
      task_id uuid NOT NULL,
      task_variant_id uuid NOT NULL,
      task_version text NOT NULL,
      administration_id uuid NOT NULL,
      use_for_reporting boolean NOT NULL,
      reliable_run boolean NOT NULL,
      engagement_flags jsonb,
      metadata jsonb,
      is_anonymous boolean NOT NULL,
      completed_at timestamptz,
      aborted_at timestamptz,
      deleted_at timestamptz,
      deleted_by uuid,
      updated_at timestamptz,
      created_at timestamptz NOT NULL
    ) SERVER assessment_server
      OPTIONS (schema_name 'app', table_name 'runs');

    DROP FOREIGN TABLE IF EXISTS app_assessment_fdw_direct.run_scores;
    CREATE FOREIGN TABLE app_assessment_fdw_direct.run_scores (
      id uuid NOT NULL,
      run_id uuid NOT NULL,
      type text NOT NULL,
      domain text NOT NULL,
      name text NOT NULL,
      value text NOT NULL,
      assessment_stage text,
      category_score boolean,
      updated_at timestamptz,
      created_at timestamptz NOT NULL
    ) SERVER assessment_server
      OPTIONS (schema_name 'app', table_name 'run_scores');
  `);
  console.log('Direct foreign tables created.\n');
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

async function seedData(): Promise<{ userIds: string[]; runIds: string[]; deletedRunIds: Set<string> }> {
  console.log('Seeding data...');
  const startTime = Date.now();

  // Generate user IDs
  const userIds = Array.from({ length: config.students }, () => randomUUID());

  // Insert minimal user records into core DB for cross-DB join query (Q4).
  // Clean up any stale benchmark users from a previous failed run first.
  try {
    await corePool.query('ALTER TABLE app.users DISABLE TRIGGER prevent_rostered_user_delete');
  } catch {
    // Trigger may not exist — safe to ignore
  }
  await corePool.query(`DELETE FROM app.users WHERE name_first = '${BENCHMARK_TAG}'`);
  try {
    await corePool.query('ALTER TABLE app.users ENABLE TRIGGER prevent_rostered_user_delete');
  } catch {
    // Match the disable
  }

  const BATCH_SIZE = 500;
  const runTag = randomUUID().slice(0, 8);
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const values = batch
      .map(
        (id, idx) =>
          `('${id}', '${BENCHMARK_TAG}-${runTag}-${i + idx}', '{"password"}', 'student', '${BENCHMARK_TAG}')`,
      )
      .join(',\n');
    await corePool.query(`
      INSERT INTO app.users (id, assessment_pid, auth_provider, user_type, name_first)
      VALUES ${values}
    `);
  }
  console.log(`  Seeded ${userIds.length} users in core DB`);

  // Generate runs
  const runIds: string[] = [];
  const RUN_BATCH = 5_000;
  let runCount = 0;

  for (let batch = 0; batch < totalRuns; batch += RUN_BATCH) {
    const batchSize = Math.min(RUN_BATCH, totalRuns - batch);
    const values: string[] = [];

    for (let i = 0; i < batchSize; i++) {
      const runId = randomUUID();
      runIds.push(runId);
      const userId = userIds[Math.floor(Math.random() * userIds.length)]!;
      const adminId = ADMINISTRATION_IDS[Math.floor(Math.random() * ADMINISTRATION_IDS.length)]!;
      const taskId = TASK_IDS[Math.floor(Math.random() * TASK_IDS.length)]!;
      const variantId = TASK_VARIANT_IDS[Math.floor(Math.random() * TASK_VARIANT_IDS.length)]!;
      const completed = Math.random() > 0.1; // 90% completed

      values.push(
        `('${runId}', '${userId}', '${taskId}', '${variantId}', '1.0.0', '${adminId}', ` +
          `${Math.random() > 0.3}, ${Math.random() > 0.2}, false, ` +
          `${completed ? 'NOW()' : 'NULL'}, ${!completed && Math.random() > 0.5 ? 'NOW()' : 'NULL'}, ` +
          `NULL, NULL)`,
      );
    }

    await assessmentPool.query(`
      INSERT INTO app.runs (
        id, user_id, task_id, task_variant_id, task_version, administration_id,
        use_for_reporting, reliable_run, is_anonymous,
        completed_at, aborted_at, deleted_at, deleted_by
      ) VALUES ${values.join(',\n')}
    `);

    runCount += batchSize;
    if (runCount % 50_000 === 0 || runCount === totalRuns) {
      console.log(`  Seeded ${runCount.toLocaleString()} / ${totalRuns.toLocaleString()} runs`);
    }
  }

  // Soft-delete some runs
  const deletedRunIds = new Set<string>();
  const shuffled = [...runIds].sort(() => Math.random() - 0.5);
  const toDelete = shuffled.slice(0, deletedRuns);
  for (const id of toDelete) deletedRunIds.add(id);

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const ids = batch.map((id) => `'${id}'`).join(',');
    // Use a random userId as the deleted_by (satisfies the CHECK constraint)
    const deletedBy = userIds[0]!;
    await assessmentPool.query(`
      UPDATE app.runs SET deleted_at = NOW(), deleted_by = '${deletedBy}'
      WHERE id IN (${ids})
    `);
  }
  console.log(`  Soft-deleted ${toDelete.length} runs`);

  // Generate run scores (only for non-deleted runs)
  const activeRunIds = runIds.filter((id) => !deletedRunIds.has(id));
  const SCORE_BATCH = 10_000;
  let scoreCount = 0;
  const targetScores = totalScores;

  // Distribute scores across active runs
  let runIndex = 0;
  let scoresGenerated = 0;

  while (scoresGenerated < targetScores) {
    const values: string[] = [];
    const batchTarget = Math.min(SCORE_BATCH, targetScores - scoresGenerated);

    for (let i = 0; i < batchTarget; i++) {
      const runId = activeRunIds[runIndex % activeRunIds.length]!;
      runIndex++;
      const domain = SCORE_DOMAINS[Math.floor(Math.random() * SCORE_DOMAINS.length)]!;
      const name = SCORE_NAMES[Math.floor(Math.random() * SCORE_NAMES.length)]!;
      const type = SCORE_TYPES[Math.floor(Math.random() * SCORE_TYPES.length)]!;
      const stage = ASSESSMENT_STAGES[Math.floor(Math.random() * ASSESSMENT_STAGES.length)]!;
      const value = (Math.random() * 100).toFixed(2);

      values.push(
        `(gen_random_uuid(), '${runId}', '${type}', '${domain}', '${name}', '${value}', '${stage}', ${Math.random() > 0.7})`,
      );
    }

    await assessmentPool.query(`
      INSERT INTO app.run_scores (id, run_id, type, domain, name, value, assessment_stage, category_score)
      VALUES ${values.join(',\n')}
    `);

    scoresGenerated += values.length;
    scoreCount += values.length;
    if (scoreCount % 100_000 === 0 || scoresGenerated >= targetScores) {
      console.log(
        `  Seeded ${scoreCount.toLocaleString()} / ${targetScores.toLocaleString()} run_scores`,
      );
    }
  }

  // ANALYZE tables on assessment DB for accurate query plans
  await assessmentPool.query('ANALYZE app.runs');
  await assessmentPool.query('ANALYZE app.run_scores');
  // ANALYZE foreign tables on core DB
  await corePool.query('ANALYZE app_assessment_fdw.runs');
  await corePool.query('ANALYZE app_assessment_fdw.run_scores');
  await corePool.query('ANALYZE app_assessment_fdw_direct.runs');
  await corePool.query('ANALYZE app_assessment_fdw_direct.run_scores');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Seeding complete in ${elapsed}s\n`);

  return { userIds, runIds, deletedRunIds };
}

// ---------------------------------------------------------------------------
// Benchmark queries
// ---------------------------------------------------------------------------

interface BenchmarkQuery {
  name: string;
  description: string;
  viewQuery: string;
  directQuery: string;
}

function buildQueries(ctx: {
  userIds: string[];
  runIds: string[];
  deletedRunIds: Set<string>;
}): BenchmarkQuery[] {
  const adminId = ADMINISTRATION_IDS[0]!;
  const userId = ctx.userIds[0]!;
  // Pick a non-deleted run for single-run queries
  const singleRunId = ctx.runIds.find((id) => !ctx.deletedRunIds.has(id))!;
  // Pick ~50 non-deleted run IDs for batch query
  const batchRunIds = ctx.runIds
    .filter((id) => !ctx.deletedRunIds.has(id))
    .slice(0, 50)
    .map((id) => `'${id}'`)
    .join(',');

  return [
    {
      name: 'Q1: Runs by administration_id',
      description: 'Baseline — view filter vs direct filter',
      viewQuery: `
        SELECT * FROM app_assessment_fdw.runs
        WHERE administration_id = '${adminId}'
        LIMIT 100
      `,
      directQuery: `
        SELECT id, user_id, task_id, task_variant_id, task_version,
               administration_id, use_for_reporting, reliable_run,
               engagement_flags, is_anonymous, completed_at, aborted_at, created_at
        FROM app_assessment_fdw_direct.runs
        WHERE administration_id = '${adminId}'
          AND deleted_at IS NULL
        LIMIT 100
      `,
    },
    {
      name: 'Q2: Count completed runs per administration',
      description: 'Aggregate pushdown',
      viewQuery: `
        SELECT administration_id, COUNT(*) as cnt
        FROM app_assessment_fdw.runs
        WHERE completed_at IS NOT NULL
        GROUP BY administration_id
      `,
      directQuery: `
        SELECT administration_id, COUNT(*) as cnt
        FROM app_assessment_fdw_direct.runs
        WHERE completed_at IS NOT NULL
          AND deleted_at IS NULL
        GROUP BY administration_id
      `,
    },
    {
      name: 'Q3: Runs + scores for a user in an administration',
      description: 'FDW join behavior',
      viewQuery: `
        SELECT r.id, r.user_id, r.task_id, r.completed_at,
               rs.domain, rs.name, rs.value, rs.type
        FROM app_assessment_fdw.runs r
        JOIN app_assessment_fdw.run_scores rs ON rs.run_id = r.id
        WHERE r.user_id = '${userId}'
          AND r.administration_id = '${adminId}'
      `,
      directQuery: `
        SELECT r.id, r.user_id, r.task_id, r.completed_at,
               rs.domain, rs.name, rs.value, rs.type
        FROM app_assessment_fdw_direct.runs r
        JOIN app_assessment_fdw_direct.run_scores rs ON rs.run_id = r.id
        WHERE r.user_id = '${userId}'
          AND r.administration_id = '${adminId}'
          AND r.deleted_at IS NULL
      `,
    },
    {
      name: 'Q4: Cross-DB join: core users + FDW runs',
      description: 'Local/remote join planning',
      viewQuery: `
        SELECT u.id, u.name_first, r.id as run_id, r.completed_at
        FROM app.users u
        JOIN app_assessment_fdw.runs r ON r.user_id = u.id
        WHERE r.administration_id = '${adminId}'
        LIMIT 100
      `,
      directQuery: `
        SELECT u.id, u.name_first, r.id as run_id, r.completed_at
        FROM app.users u
        JOIN app_assessment_fdw_direct.runs r ON r.user_id = u.id
        WHERE r.administration_id = '${adminId}'
          AND r.deleted_at IS NULL
        LIMIT 100
      `,
    },
    {
      name: 'Q5: Aggregate scores by domain for an administration',
      description: 'Complex remote query',
      viewQuery: `
        SELECT rs.domain, rs.type, COUNT(*) as cnt, AVG(rs.value::numeric) as avg_val
        FROM app_assessment_fdw.runs r
        JOIN app_assessment_fdw.run_scores rs ON rs.run_id = r.id
        WHERE r.administration_id = '${adminId}'
          AND r.completed_at IS NOT NULL
        GROUP BY rs.domain, rs.type
      `,
      directQuery: `
        SELECT rs.domain, rs.type, COUNT(*) as cnt, AVG(rs.value::numeric) as avg_val
        FROM app_assessment_fdw_direct.runs r
        JOIN app_assessment_fdw_direct.run_scores rs ON rs.run_id = r.id
        WHERE r.administration_id = '${adminId}'
          AND r.completed_at IS NOT NULL
          AND r.deleted_at IS NULL
        GROUP BY rs.domain, rs.type
      `,
    },
    {
      name: 'Q6: Run scores by single run_id',
      description: 'Key test — view always joins runs, direct skips it',
      viewQuery: `
        SELECT * FROM app_assessment_fdw.run_scores
        WHERE run_id = '${singleRunId}'
      `,
      directQuery: `
        SELECT id, run_id, type, domain, name, value, assessment_stage, category_score, created_at
        FROM app_assessment_fdw_direct.run_scores
        WHERE run_id = '${singleRunId}'
      `,
    },
    {
      name: 'Q7: Run scores by batch of ~50 run_ids',
      description: 'Batch variant of Q6',
      viewQuery: `
        SELECT * FROM app_assessment_fdw.run_scores
        WHERE run_id IN (${batchRunIds})
      `,
      directQuery: `
        SELECT id, run_id, type, domain, name, value, assessment_stage, category_score, created_at
        FROM app_assessment_fdw_direct.run_scores
        WHERE run_id IN (${batchRunIds})
      `,
    },
  ];
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

interface TimingResult {
  planningMs: number;
  executionMs: number;
  totalMs: number;
}

interface QueryResult {
  name: string;
  description: string;
  view: { cold: TimingResult; warm: TimingResult };
  direct: { cold: TimingResult; warm: TimingResult };
}

function parseExplainAnalyze(rows: Array<{ 'QUERY PLAN': string }>): TimingResult {
  const text = rows.map((r) => r['QUERY PLAN']).join('\n');

  const planMatch = text.match(/Planning Time:\s+([\d.]+)\s+ms/);
  const execMatch = text.match(/Execution Time:\s+([\d.]+)\s+ms/);

  const planningMs = planMatch ? parseFloat(planMatch[1]!) : 0;
  const executionMs = execMatch ? parseFloat(execMatch[1]!) : 0;

  return { planningMs, executionMs, totalMs: planningMs + executionMs };
}

async function runExplainAnalyze(pool: Pool, sql: string): Promise<TimingResult> {
  const result = await pool.query(`EXPLAIN ANALYZE ${sql}`);
  return parseExplainAnalyze(result.rows);
}

async function measureQuery(
  pool: Pool,
  sql: string,
  warmRuns: number,
): Promise<{ cold: TimingResult; warm: TimingResult }> {
  // Cold run: clear all caches
  await pool.query('DISCARD ALL');
  const cold = await runExplainAnalyze(pool, sql);

  // Warm runs: skip first, average the rest
  const timings: TimingResult[] = [];
  for (let i = 0; i < warmRuns; i++) {
    const t = await runExplainAnalyze(pool, sql);
    if (i > 0) timings.push(t); // skip first warm run
  }

  const warm =
    timings.length > 0
      ? {
          planningMs: timings.reduce((s, t) => s + t.planningMs, 0) / timings.length,
          executionMs: timings.reduce((s, t) => s + t.executionMs, 0) / timings.length,
          totalMs: timings.reduce((s, t) => s + t.totalMs, 0) / timings.length,
        }
      : cold;

  return { cold, warm };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanup(userIds: string[]): Promise<void> {
  console.log('\nCleaning up...');

  // Drop direct foreign tables schema
  await corePool.query('DROP SCHEMA IF EXISTS app_assessment_fdw_direct CASCADE');

  // Delete seeded assessment data
  // run_scores cascade-deletes with runs
  const BATCH_SIZE = 500;
  // Delete runs by administration IDs (covers all seeded runs)
  for (const adminId of ADMINISTRATION_IDS) {
    await assessmentPool.query(`DELETE FROM app.runs WHERE administration_id = '${adminId}'`);
  }

  // Delete seeded users from core DB.
  // The prevent_rostered_user_delete trigger blocks DELETE on users that have
  // rostering_provider_ids entries. Our seeded users don't have any, but we
  // disable it to avoid the enum cast issue in the trigger function.
  if (userIds.length > 0) {
    try {
      await corePool.query('ALTER TABLE app.users DISABLE TRIGGER prevent_rostered_user_delete');
    } catch {
      // Trigger may not exist if migrations haven't run fully — safe to ignore
    }
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const ids = batch.map((id) => `'${id}'`).join(',');
      await corePool.query(`DELETE FROM app.users WHERE id IN (${ids})`);
    }
    try {
      await corePool.query('ALTER TABLE app.users ENABLE TRIGGER prevent_rostered_user_delete');
    } catch {
      // Match the disable — if it didn't exist, re-enable will also fail
    }
  }

  console.log('Cleanup complete.\n');
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(3)} ms`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function printResults(results: QueryResult[]): void {
  const COL_Q = 55;
  const COL_W = 15;
  const LINE_W = COL_Q + COL_W * 2 + 12 + 8;

  console.log('\n' + '='.repeat(LINE_W));
  console.log('RESULTS');
  console.log('='.repeat(LINE_W));

  // Header
  console.log(
    padEnd('Query', COL_Q) +
      padEnd('View (warm)', COL_W) +
      padEnd('Direct (warm)', COL_W) +
      padEnd('Diff', 12) +
      'Winner',
  );
  console.log('-'.repeat(LINE_W));

  for (const r of results) {
    const viewMs = r.view.warm.totalMs;
    const directMs = r.direct.warm.totalMs;
    const diff = ((directMs - viewMs) / viewMs) * 100;
    const winner = directMs < viewMs ? 'DIRECT' : viewMs < directMs ? 'VIEW' : 'TIE';
    const diffStr = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;

    console.log(
      padEnd(r.name, COL_Q) +
        padEnd(formatMs(viewMs), COL_W) +
        padEnd(formatMs(directMs), COL_W) +
        padEnd(diffStr, 12) +
        winner,
    );
  }

  console.log('-'.repeat(LINE_W));

  // Detailed breakdown
  console.log('\n\nDETAILED BREAKDOWN');
  console.log('='.repeat(LINE_W));

  for (const r of results) {
    console.log(`\n${r.name} — ${r.description}`);
    console.log(
      `  View:   cold ${formatMs(r.view.cold.totalMs)} (plan: ${formatMs(r.view.cold.planningMs)}, exec: ${formatMs(r.view.cold.executionMs)})` +
        ` | warm ${formatMs(r.view.warm.totalMs)} (plan: ${formatMs(r.view.warm.planningMs)}, exec: ${formatMs(r.view.warm.executionMs)})`,
    );
    console.log(
      `  Direct: cold ${formatMs(r.direct.cold.totalMs)} (plan: ${formatMs(r.direct.cold.planningMs)}, exec: ${formatMs(r.direct.cold.executionMs)})` +
        ` | warm ${formatMs(r.direct.warm.totalMs)} (plan: ${formatMs(r.direct.warm.planningMs)}, exec: ${formatMs(r.direct.warm.executionMs)})`,
    );
  }
}

function padEnd(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let userIds: string[] = [];

  try {
    // Verify FDW is set up
    try {
      await corePool.query('SELECT 1 FROM app_assessment_fdw.runs LIMIT 1');
    } catch {
      console.error(
        'ERROR: FDW is not set up. Run:\n' +
          '  ./scripts/setup-fdw-local.sh\n' +
          '  npm run db:migrate -w apps/backend',
      );
      process.exit(1);
    }

    await setupDirectForeignTables();
    const ctx = await seedData();
    userIds = ctx.userIds;

    const queries = buildQueries(ctx);
    const results: QueryResult[] = [];

    const WARM_RUNS = 5;

    for (const q of queries) {
      console.log(`Benchmarking: ${q.name}...`);

      const view = await measureQuery(corePool, q.viewQuery, WARM_RUNS);
      const direct = await measureQuery(corePool, q.directQuery, WARM_RUNS);

      results.push({
        name: q.name,
        description: q.description,
        view,
        direct,
      });

      console.log(
        `  View: ${formatMs(view.warm.totalMs)} | Direct: ${formatMs(direct.warm.totalMs)}`,
      );
    }

    printResults(results);
  } catch (err) {
    console.error('\nBenchmark error:', err);
    // Fall through to cleanup
  } finally {
    if (!noCleanup) {
      await cleanup(userIds).catch((cleanupErr) => {
        console.error('Cleanup error (non-fatal):', cleanupErr);
      });
    } else {
      // Still drop the direct schema description, but keep data
      console.log('\n--no-cleanup: keeping seeded data. Direct schema retained for inspection.');
      console.log('To clean up manually:');
      console.log(
        `  psql -d core -c "DROP SCHEMA IF EXISTS app_assessment_fdw_direct CASCADE;"`,
      );
      for (const adminId of ADMINISTRATION_IDS) {
        console.log(
          `  psql -d assessment -c "DELETE FROM app.runs WHERE administration_id = '${adminId}';"`,
        );
      }
    }

    await corePool.end();
    await assessmentPool.end();
  }
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
