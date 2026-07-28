/**
 * Seed the default set of real assessments and assign each to the fixture's launch
 * sandbox administration, so a greenfield environment can launch a task from the
 * dashboard.
 *
 * The dev fixture's own tasks come from `TaskFactory`, whose slugs are generated
 * (`task-3-a3f9k2`). The dashboard's launch components resolve against canonical
 * slugs from `@roar-platform/assessment-schema` (`swr`, `sre`, …), so fixture tasks
 * are never launchable. Rather than replace them — they drive the progress and score
 * fixtures — this step seeds the real ones into a separate administration that holds
 * nothing else, keeping launchable and non-launchable tasks from mixing in one list.
 *
 * Each assessment is seeded by spawning `task-seed.ts`, which owns parameter
 * validation, task/variant creation, and the `defaultVariant` assignment. Spawning
 * rather than importing keeps that script's module-level CLI parsing and pool
 * lifecycle intact, and isolates a failure in one assessment from the others.
 *
 * Environment variables:
 * - CORE_DATABASE_URL: Core database connection string (required, inherited)
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { createChildLogger } from '../src/logger';
import { MONOREPO_ROOT } from '../src/test-support/paths';

const logger = createChildLogger({}, { msgPrefix: '[dev:tasks] ' });

/**
 * Assessments seeded by `dev:init`.
 *
 * Deliberately a subset: every registered assessment would put dozens of tiles on
 * the participant home and lengthen setup, while these four cover the launch paths
 * most work touches. Seed anything else on demand with
 * `npm run dev:seed:tasks -- --task <name>`.
 */
export const DEFAULT_SEEDED_ASSESSMENTS = ['roar-swr', 'roar-sre', 'roar-letter', 'roar-pa'] as const;

/**
 * Seed one assessment's tasks and variants.
 *
 * `taskVariantParameters.json` is gitignored, so a fresh checkout has only the
 * committed example. Copy it when absent — that file is already the canonical
 * starting point, and CI does the same thing for the assessment e2e stack.
 *
 * @param assessment - Directory name under `apps/assessments/`
 * @returns Whether the seed run succeeded
 */
function seedAssessment(assessment: string): boolean {
  const assessmentDir = path.join(MONOREPO_ROOT, 'apps', 'assessments', assessment);
  const parametersFile = path.join(assessmentDir, 'taskVariantParameters.json');
  const exampleFile = path.join(assessmentDir, 'taskVariantParameters.example.json');

  if (!existsSync(parametersFile)) {
    if (!existsSync(exampleFile)) {
      logger.warn({ assessment }, 'No taskVariantParameters.example.json — skipping');
      return false;
    }
    copyFileSync(exampleFile, parametersFile);
    logger.info({ assessment }, 'Copied taskVariantParameters.example.json → taskVariantParameters.json');
  }

  const result = spawnSync('npx', ['tsx', path.join(import.meta.dirname, 'task-seed.ts'), '--task', assessment], {
    cwd: path.join(MONOREPO_ROOT, 'apps', 'backend'),
    env: { ...process.env, TASK_VARIANT_PARAMETERS_FILE: parametersFile },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    logger.error({ assessment, status: result.status }, 'Task seed failed');
    return false;
  }

  return true;
}

/**
 * Seed every assessment in {@link DEFAULT_SEEDED_ASSESSMENTS}.
 *
 * A failure in one assessment is logged and does not abort the rest — a broken
 * parameters file for one assessment shouldn't cost a developer the whole
 * environment.
 */
export async function runSeedDefaultTasks(): Promise<void> {
  logger.info({ assessments: DEFAULT_SEEDED_ASSESSMENTS }, 'Seeding default assessment tasks...');

  const failed = DEFAULT_SEEDED_ASSESSMENTS.filter((assessment) => !seedAssessment(assessment));

  if (failed.length > 0) {
    logger.warn({ failed }, 'Some assessments failed to seed — the rest are available');
    return;
  }

  logger.info('Default assessment tasks seeded and assigned to the launch sandbox administration.');
}

// Run directly when invoked as a script
const isDirectRun =
  process.argv[1]?.endsWith('seed-default-tasks.js') || process.argv[1]?.endsWith('seed-default-tasks.ts');

if (isDirectRun) {
  runSeedDefaultTasks().catch((err) => {
    logger.fatal({ err }, 'Default task seeding failed');
    process.exit(1);
  });
}
