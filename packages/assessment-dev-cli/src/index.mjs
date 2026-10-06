/**
 * Entry point for the assessment environment CLI, invoked from each
 * assessment package's npm scripts as:
 *
 *   node ../../../packages/assessment-dev-cli/src/index.mjs <command> [args]
 *
 * Commands map 1:1 to the npm scripts: setup, start, stop, restart,
 * seed-tasks, rebuild, predev. Extra args are forwarded to the command
 * (e.g. `npm run seed:tasks -- --refresh-params`).
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ASSESSMENT_NAME, REPO_ROOT, validAssessmentName } from './context.mjs';
import { npmCli, run } from './proc.mjs';
import { loadUi } from './ui.mjs';

const COMMANDS = {
  setup: async () => (await import('./commands/setup.mjs')).setup,
  start: async () => (await import('./commands/start.mjs')).start,
  stop: async () => (await import('./commands/stop.mjs')).stop,
  restart: async () => (await import('./commands/restart.mjs')).restart,
  'seed-tasks': async () => (await import('./commands/seed-tasks.mjs')).seedTasks,
  rebuild: async () => (await import('./commands/rebuild.mjs')).rebuild,
  predev: async () => (await import('./commands/predev.mjs')).predev,
};

const [command, ...args] = process.argv.slice(2);

if (!command || !(command in COMMANDS)) {
  console.error(`Unknown command: ${command ?? '(none)'}`);
  console.error(`Usage: assessment-dev-cli <${Object.keys(COMMANDS).join('|')}> [args]`);
  process.exit(1);
}

// The directory name becomes the compose substitution variable ASSESSMENT_NAME,
// which lands inside a `sh -c` command string and a volume mount path — reject
// anything that is not a plain assessment package name before it gets there.
if (!validAssessmentName(ASSESSMENT_NAME)) {
  console.error(`"${ASSESSMENT_NAME}" is not an assessment package name (expected lowercase letters, digits, and -).`);
  console.error('Run the CLI from an assessment directory under apps/assessments/.');
  process.exit(1);
}

// First-run bootstrap: on a fresh clone, setup runs before its own
// dependencies exist. Node caches a failed module resolution for the life of
// the process, so the rich UI cannot be picked up mid-run — instead, install
// first with one plain progress line, then re-exec setup in a fresh process
// that loads @clack/prompts from its first frame (its own install step is
// then a fast no-op). ROAR_CLI_BOOTSTRAPPED guards against recursing when
// the install succeeded but the resolution still fails for another reason.
function clackResolvable() {
  try {
    createRequire(import.meta.url).resolve('@clack/prompts');
    return true;
  } catch {
    return false;
  }
}

if (command === 'setup' && !process.env.ROAR_CLI_PLAIN && !process.env.ROAR_CLI_BOOTSTRAPPED && !clackResolvable()) {
  console.log('First run: installing dependencies (this can take a few minutes)...');
  // --no-audit/--no-fund/--loglevel=error: a researcher's first screen should
  // not be vulnerability counts, funding asks, and deprecation warnings.
  // Errors still print.
  const installStatus = run([...npmCli(), 'install', '--no-audit', '--no-fund', '--loglevel=error'], {
    cwd: REPO_ROOT,
  });
  if (installStatus !== 0) {
    console.error('npm install failed — fix the error above and re-run npm run setup.');
    process.exit(installStatus);
  }
  const childStatus = run([process.execPath, fileURLToPath(import.meta.url), 'setup', ...args], {
    env: { ROAR_CLI_BOOTSTRAPPED: '1' },
  });
  process.exit(childStatus);
}

const ui = await loadUi();
try {
  const handler = await COMMANDS[command]();
  await handler(ui, args);
} catch (error) {
  // Last-resort handler: every expected failure sets process.exitCode with a
  // curated message; anything landing here is a CLI bug worth the stack trace.
  ui.error(error?.stack ?? String(error));
  process.exitCode = 1;
}
