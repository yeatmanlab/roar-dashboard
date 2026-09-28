/**
 * `npm run seed:tasks` — seed task variants into the *already running*
 * environment, without tearing anything down.
 *
 * The normal task/variant seed runs once, inside the assessment-db-migrate
 * container, at environment bring-up. That container does not re-run on
 * `npm start` when the stack is already up, and `npm restart` / `npm stop`
 * wipe the database volume — and with it every run, trial, and score you have
 * generated. This command closes that gap: it runs the same idempotent,
 * additive-by-name seeder from the host against the live container database.
 *
 * Extra arguments are forwarded to the seeder. The one researchers need:
 *   npm run seed:tasks -- --refresh-params
 * re-applies the parameter values from taskVariantParameters.json to variants
 * that already exist (a plain run is additive by name and skips them).
 */
import { existsSync } from 'node:fs';
import { ASSESSMENT_NAME, PARAMS_FILE, REPO_ROOT, resolvePgPort } from '../context.mjs';
import { containerRunning } from '../docker.mjs';
import { paramsFileMissingLines } from '../help.mjs';
import { npmCli, run } from '../proc.mjs';

export async function seedTasks(ui, args = []) {
  if (!existsSync(PARAMS_FILE)) {
    const [headline, ...rest] = paramsFileMissingLines();
    ui.note(rest.join('\n'), headline, 'error');
    process.exitCode = 1;
    return;
  }

  // The seeder connects to the container's published Postgres port — if the
  // stack isn't up there is nothing to seed into.
  if (!containerRunning('assessment-db')) {
    ui.note(
      'Start it first, then re-run this command:\n  npm start',
      'The assessment environment is not running',
      'error',
    );
    process.exitCode = 1;
    return;
  }

  const pgPort = resolvePgPort();
  ui.step(`Seeding task variants for "${ASSESSMENT_NAME}" from taskVariantParameters.json...`);
  if (args.includes('--refresh-params')) {
    ui.info('Updating existing variants with the parameters in the file. Your generated data is left untouched.');
  } else {
    ui.info('Only new variants are added; existing variants and your generated data are left untouched.');
    ui.info('To apply changed parameters to an existing variant, run: npm run seed:tasks -- --refresh-params');
  }

  // Run the same seeder the migrate container uses, but from the host against
  // the live database. Env vars set here take precedence over apps/backend/.env
  // (dotenv does not override already-set variables), so this targets the
  // container DB regardless of local backend config.
  const status = run(
    [...npmCli(), 'run', 'dev:seed:tasks', '-w', 'apps/backend', '--', '--task', ASSESSMENT_NAME, ...args],
    {
      cwd: REPO_ROOT,
      env: {
        CORE_DATABASE_URL: `postgres://postgres:postgres@localhost:${pgPort}/roar_core`,
        TASK_VARIANT_PARAMETERS_FILE: PARAMS_FILE,
      },
    },
  );
  if (status !== 0) {
    process.exitCode = status;
    return;
  }

  ui.success('Done. Reload the assessment (or use the variant picker) to see the new variants.');
}
