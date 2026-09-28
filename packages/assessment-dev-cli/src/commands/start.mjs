/**
 * `npm start` — bring up the shared Docker stack (DB, migrations, Firebase
 * emulators, backend), then run the assessment's dev server.
 *
 * Its preflight checks are hard gates (unlike `setup`, whose equivalent checks
 * are advisory): setup is optional, so this command cannot assume it ran and
 * must fail safe on its own.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { ASSESSMENT_BACKEND_URL, ASSESSMENT_NAME, PARAMS_FILE, resolvePgPort, stackPorts } from '../context.mjs';
import {
  compose,
  composeAvailable,
  composeStreamed,
  containerRunning,
  daemonRunning,
  diagnosePortConflict,
} from '../docker.mjs';
import { DOCKER_DAEMON_LINES, DOCKER_INSTALL_LINES, paramsFileMissingLines } from '../help.mjs';
import { portInUse } from '../net.mjs';
import { capture, npmCli, runStreamed } from '../proc.mjs';
import { seederInvocation } from './seed-tasks.mjs';

/** Containers force-removed before a fresh bring-up (stale-run leftovers). */
const STALE_CONTAINERS = [
  'assessment-db',
  'assessment-db-migrate',
  'firebase-auth-emulator', // retired container name from older checkouts
  'firebase-emulator',
  'assessment-backend',
];

/** The supabase-style service summary shown once the environment is up. */
function printRunningSummary(ui, pgPort) {
  const rows = [
    ['Firebase Emulator', 'http://localhost:9002'],
    ['Backend API', ASSESSMENT_BACKEND_URL],
    ['Database URLs', `postgres://postgres:postgres@localhost:${pgPort}/roar_core`],
    ['', `postgres://postgres:postgres@localhost:${pgPort}/roar_assessment`],
    ['DB browser', 'npx pgweb --url "<database URL>?sslmode=disable"'],
  ];
  const labelWidth = Math.max(...rows.map(([label]) => label.length), 'Assessment'.length) + 2;
  // The assessment URL is the one researchers actually need — bold, set apart.
  const lines = [
    ui.strong(`${'Assessment'.padEnd(labelWidth)}http://localhost:8000`),
    '',
    ...rows.map(([label, value]) => `${label.padEnd(labelWidth)}${value}`),
  ];
  ui.note(lines.join('\n'), `${ASSESSMENT_NAME} is running`, 'done');
}

export async function start(ui) {
  const pgPort = resolvePgPort();

  if (!composeAvailable()) {
    ui.note(DOCKER_INSTALL_LINES.join('\n'), 'Docker with Compose v2 is required', 'error');
    process.exitCode = 1;
    return;
  }
  if (!daemonRunning()) {
    ui.note(DOCKER_DAEMON_LINES.join('\n'), 'Docker is installed but not running', 'error');
    process.exitCode = 1;
    return;
  }

  // If the backend AND emulator containers are running the full stack is up —
  // the backend only starts after migrations and the Firebase emulators are
  // healthy. This covers the common case where the user killed the dev server
  // with Ctrl+C but left the Docker stack running. Both containers are
  // required: with only the backend running (emulator crashed or stopped),
  // skipping the bring-up would send predev into a loop where its suggested
  // fix — `npm start` — takes this same skip path; falling through to
  // `docker compose up` heals a partial stack instead (the DB volume survives
  // container removal).
  if (containerRunning('assessment-backend') && containerRunning('firebase-emulator')) {
    ui.intro(`${ASSESSMENT_NAME} start`);
    ui.success('Assessment environment already running.');

    // The bring-up path seeds via the migrate container, but a running stack
    // was seeded for whichever assessment started it — switching assessments
    // with Ctrl+C + cd + npm start would otherwise land in a database without
    // this assessment's tasks/variants. The seeder is idempotent and additive,
    // so re-running it here makes every switch path just `npm start`.
    if (!existsSync(PARAMS_FILE)) {
      const [headline, ...rest] = paramsFileMissingLines();
      ui.note(rest.join('\n'), headline, 'error');
      process.exitCode = 1;
      return;
    }
    const seed = ui.task(`Making sure "${ASSESSMENT_NAME}" tasks and variants are seeded...`);
    const { command, options } = seederInvocation(pgPort);
    const seedStatus = await runStreamed(command, options, seed.line);
    if (seedStatus !== 0) {
      seed.fail(
        'Seeding failed — fix the reported problem (usually a taskVariantParameters.json entry), then npm start.',
      );
      process.exitCode = seedStatus;
      return;
    }
    seed.done('Tasks and variants are seeded.');
  } else {
    ui.intro(`${ASSESSMENT_NAME} start`);

    // Require the config file before Docker tries to seed from it.
    if (!existsSync(PARAMS_FILE)) {
      const [headline, ...rest] = paramsFileMissingLines();
      ui.note(rest.join('\n'), headline, 'error');
      process.exitCode = 1;
      return;
    }

    // Force-remove stale containers by name before starting. These linger from
    // a previous run and cause name or port conflicts — including containers
    // left under an older compose project name (docker rm by name ignores
    // project scoping, unlike --remove-orphans). Runs before the port preflight
    // so leftovers from a previous assessment run self-heal instead of erroring.
    capture(['docker', 'rm', '-f', ...STALE_CONTAINERS]);

    // Check every port the stack binds before Docker tries to — the error
    // Docker produces when a port is taken is cryptic, and the fix differs by
    // culprit.
    for (const port of stackPorts(pgPort)) {
      if (portInUse(port)) {
        ui.note(diagnosePortConflict(port, pgPort).join('\n'), `Port ${port} is already in use`, 'error');
        process.exitCode = 1;
        return;
      }
    }

    // --remove-orphans drops any container in the roar-assessment project whose
    // service no longer exists, so future service renames self-heal without
    // needing to be listed above. On failure, surface the container logs before
    // exiting: compose reports only a terse exit line, while the actual error —
    // most commonly the seeder naming an invalid taskVariantParameters.json
    // entry — is in the container's own output.
    const up = ui.task('Starting the environment (database, Firebase emulators, backend)...');
    if (!(await composeStreamed(['up', '-d', '--wait', '--remove-orphans'], pgPort, up.line))) {
      up.fail('The environment failed to start.');
      ui.step("Details from the environment's logs:");
      compose(['logs', '--no-color', '--tail=40', 'assessment-db-migrate', 'backend'], pgPort);
      ui.note(
        'Fix the reported problem (an invalid taskVariantParameters.json entry\nis the usual cause), then run: npm start',
        'Next step',
      );
      process.exitCode = 1;
      return;
    }

    up.done('Environment ready.');
  }

  printRunningSummary(ui, pgPort);
  // Each package's `dev` script is the single source of truth for its bundler
  // invocation (webpack or vite). The emulator hosts need no explicit values —
  // dev-mode bundler configs default them to this stack's emulators.
  // BACKEND_URL points the /v1 proxy at the containerized backend (plain HTTP
  // on 4002) instead of the host-run TLS default on 4000.
  ui.info('Starting the dev server — Ctrl+C stops it; the environment keeps running until npm stop.');
  // npm's --silent drops the lifecycle banners; --no-deprecation silences
  // third-party DeprecationWarnings from the dev server's dependencies, which
  // researchers can neither act on nor need to see.
  // Output is piped through the gutter so the whole session reads as one
  // piece; FORCE_COLOR keeps webpack's own colors alive across the pipe.
  const [cmd, ...args] = [...npmCli(), 'run', '--silent', 'dev'];
  const child = spawn(cmd, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: {
      ...process.env,
      BACKEND_URL: ASSESSMENT_BACKEND_URL,
      FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --no-deprecation`.trim(),
    },
  });
  let buffer = '';
  const consume = (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) ui.stream(line);
  };
  child.stdout.on('data', consume);
  child.stderr.on('data', consume);
  // Ctrl+C goes to the whole foreground process group; let the dev server
  // handle it and mirror its exit instead of dying first.
  process.on('SIGINT', () => {});
  process.on('SIGTERM', () => {});
  await new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      if (buffer) ui.stream(buffer);
      if (signal || code === 0) {
        ui.outro('Dev server stopped — the environment keeps running until npm stop.');
      } else {
        process.exitCode = code ?? 1;
      }
      resolve();
    });
  });
}
