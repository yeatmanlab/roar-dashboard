/**
 * `npm run setup` — first-run setup for the local assessment environment.
 *
 * Docker availability and the host ports are checked but NOT required to
 * finish setup — neither is needed for the install/build/copy steps. Any
 * blocker is collected and re-printed at the end so it is resolved before
 * `npm start`.
 *
 * This command must work from a fresh clone with an empty node_modules (it
 * performs the install itself), so its first-ever run renders on the styled
 * zero-dependency fallback UI — Node caches the failed @clack/prompts
 * resolution for the life of the process, so there is no mid-run upgrade;
 * every later command gets the rich UI.
 */
import { copyFileSync, existsSync } from 'node:fs';
import {
  ASSESSMENT_NAME,
  PARAMS_EXAMPLE_FILE,
  PARAMS_FILE,
  REPO_ROOT,
  resolvePgPort,
  stackPorts,
} from '../context.mjs';
import { composeAvailable, daemonRunning, diagnosePortConflict } from '../docker.mjs';
import { DOCKER_DAEMON_LINES, DOCKER_INSTALL_LINES } from '../help.mjs';
import { portInUse } from '../net.mjs';
import { npmCli, runStreamed } from '../proc.mjs';

/** Must match the "engines" floor in the root package.json. */
const NODE_MAJOR_FLOOR = 22;

export async function setup(ui) {
  const warnings = [];
  const pgPort = resolvePgPort();

  ui.intro(`${ASSESSMENT_NAME} setup`);

  // ── 1. Node.js version ─────────────────────────────────────────────────────
  // npm alone only warns (EBADENGINE) and continues on old Node, and the
  // eventual failure looks unrelated.
  ui.step('[1/5] Checking Node.js...');
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor >= NODE_MAJOR_FLOOR) {
    ui.success(`Found Node ${process.version}.`);
  } else {
    ui.note(
      `Install it from https://nodejs.org, or:\n  brew install node@${NODE_MAJOR_FLOOR} (macOS) / nvm install ${NODE_MAJOR_FLOOR}`,
      `Node ${NODE_MAJOR_FLOOR}+ is required (found ${process.version})`,
      'warn',
    );
    warnings.push(`Install Node ${NODE_MAJOR_FLOOR}+ and re-run 'npm run setup'.`);
  }

  // ── 2. Docker ──────────────────────────────────────────────────────────────
  ui.step('[2/5] Checking Docker...');
  if (!composeAvailable()) {
    ui.note(DOCKER_INSTALL_LINES.join('\n'), 'Docker was not found on this machine', 'warn');
    warnings.push("Install Docker (Compose v2) before running 'npm start'.");
  } else if (!daemonRunning()) {
    ui.note(DOCKER_DAEMON_LINES.join('\n'), 'Docker is installed but not running', 'warn');
    warnings.push("Start Docker before running 'npm start'.");
  } else {
    ui.success('Docker is installed and running.');
  }

  // ── 3. Stack host ports ────────────────────────────────────────────────────
  // Advisory only: `npm start` force-removes stale assessment containers
  // before its own (hard) port check, so a clash from a leftover assessment
  // run resolves itself — but a running platform stack or local process won't.
  ui.step("[3/5] Checking that the environment's network ports are free...");
  const busyPorts = [];
  for (const port of stackPorts(pgPort)) {
    if (portInUse(port)) {
      ui.note(diagnosePortConflict(port, pgPort).join('\n'), `Port ${port} is already in use`, 'warn');
      busyPorts.push(port);
    }
  }
  if (busyPorts.length > 0) {
    warnings.push(`Free the port(s) listed above (${busyPorts.join(', ')}) before running 'npm start'.`);
  } else {
    ui.success('All ports are free.');
  }

  // ── 4. Install + build platform libraries ──────────────────────────────────
  // The assessment dev server bundles these workspace libraries from their
  // built dist/. A filtered build (rather than a full `turbo run build` of the
  // dashboard and every assessment) keeps first-run fast and resilient to
  // unrelated breakage; `dependsOn: ["^build"]` still pulls in their upstream
  // dependencies.
  // The first-run bootstrap in index.mjs ran the install seconds ago —
  // re-verifying the whole tree would only add noise and time, so the
  // bootstrapped run builds only.
  // --output-logs=errors-only keeps successful (often cache-replayed) build
  // logs out of the collapsing tail; a failing task still prints its full
  // output. npm's --silent drops the script banners, and the env var silences
  // turbo's update banner.
  const build = ui.task(
    process.env.ROAR_CLI_BOOTSTRAPPED
      ? '[4/5] Building platform libraries (dependencies were installed a moment ago)...'
      : '[4/5] Installing dependencies and building platform libraries (this can take a few minutes)...',
  );
  if (!process.env.ROAR_CLI_BOOTSTRAPPED) {
    const installStatus = await runStreamed(
      [...npmCli(), 'install', '--no-audit', '--no-fund', '--loglevel=error'],
      { cwd: REPO_ROOT },
      build.line,
    );
    if (installStatus !== 0) {
      build.fail('npm install failed — fix the error above and re-run npm run setup.');
      process.exitCode = installStatus;
      return;
    }
  }
  const buildStatus = await runStreamed(
    [
      ...npmCli(),
      'run',
      '--silent',
      'build',
      '--',
      '--filter=@roar-platform/api-contract',
      '--filter=@roar-platform/assessment-schema',
      '--filter=@roar-platform/scoring-tables',
      '--filter=@roar-platform/assessment-sdk',
      '--output-logs=errors-only',
    ],
    { cwd: REPO_ROOT, env: { TURBO_NO_UPDATE_NOTIFIER: '1' } },
    build.line,
  );
  if (buildStatus !== 0) {
    build.fail('The platform library build failed — fix the error above and re-run npm run setup.');
    process.exitCode = buildStatus;
    return;
  }
  build.done(
    process.env.ROAR_CLI_BOOTSTRAPPED
      ? 'Platform libraries built.'
      : 'Dependencies installed and platform libraries built.',
  );

  // ── 5. taskVariantParameters.json ──────────────────────────────────────────
  ui.step('[5/5] Setting up taskVariantParameters.json...');
  if (existsSync(PARAMS_FILE)) {
    ui.success('taskVariantParameters.json already exists — leaving it untouched.');
  } else if (existsSync(PARAMS_EXAMPLE_FILE)) {
    copyFileSync(PARAMS_EXAMPLE_FILE, PARAMS_FILE);
    ui.success(
      'Created taskVariantParameters.json from the example — this file defines the variants your assessment can run.',
    );
  } else {
    ui.warn('No taskVariantParameters.example.json found in this directory.');
    warnings.push("Create taskVariantParameters.json manually before running 'npm start'.");
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  if (warnings.length > 0) {
    ui.note(warnings.map((w) => `- ${w}`).join('\n'), "Resolve these before running 'npm start'", 'warn');
  }
  ui.note(
    [
      'Start the environment:      npm start',
      'Setup & script reference:   apps/assessments/ASSESSMENT_ENVIRONMENT.md',
      'Research loop & queries:    apps/assessments/ASSESSMENT_RESEARCH_GUIDE.md',
    ].join('\n'),
    'Next steps',
  );
  ui.outro('Setup complete.');
}
