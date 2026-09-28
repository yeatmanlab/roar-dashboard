/**
 * `npm run setup` — first-run setup for the local assessment environment.
 *
 * Docker availability and the host ports are checked but NOT required to
 * finish setup — neither is needed for the install/build/copy steps. Any
 * blocker is collected and re-printed at the end so it is resolved before
 * `npm start`.
 *
 * This command must work from a fresh clone with an empty node_modules (it
 * performs the install itself), so it starts on the plain UI and upgrades to
 * the rich one after the install step.
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
import { npmCli, run } from '../proc.mjs';
import { loadUi } from '../ui.mjs';

/** Must match the "engines" floor in the root package.json. */
const NODE_MAJOR_FLOOR = 22;

export async function setup(initialUi) {
  let ui = initialUi;
  const warnings = [];
  const pgPort = resolvePgPort();

  ui.intro(`Setting up the assessment environment for "${ASSESSMENT_NAME}"`);

  // ── 1. Node.js version ─────────────────────────────────────────────────────
  // npm alone only warns (EBADENGINE) and continues on old Node, and the
  // eventual failure looks unrelated.
  ui.step(`[1/5] Checking the Node.js version (need ${NODE_MAJOR_FLOOR}+)...`);
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor >= NODE_MAJOR_FLOOR) {
    ui.success(`Found Node ${process.version}.`);
  } else {
    ui.warn(`Node ${NODE_MAJOR_FLOOR}+ is required (found: ${process.version}).`);
    ui.note(
      `Install it from https://nodejs.org, or:\n  brew install node@${NODE_MAJOR_FLOOR} (macOS) / nvm install ${NODE_MAJOR_FLOOR}`,
      'Upgrade Node',
    );
    warnings.push(`Install Node ${NODE_MAJOR_FLOOR}+ and re-run 'npm run setup'.`);
  }

  // ── 2. Docker ──────────────────────────────────────────────────────────────
  ui.step('[2/5] Checking Docker (Compose v2)...');
  if (!composeAvailable()) {
    ui.warn('Docker with Compose v2 was not found.');
    ui.note(DOCKER_INSTALL_LINES.join('\n'), 'Install Docker');
    warnings.push("Install Docker (Compose v2) before running 'npm start'.");
  } else if (!daemonRunning()) {
    ui.warn('Docker is installed but not running.');
    ui.note(DOCKER_DAEMON_LINES.join('\n'), 'Start Docker');
    warnings.push("Start Docker before running 'npm start'.");
  } else {
    ui.success('Found Docker with Compose v2 (daemon running).');
  }

  // ── 3. Stack host ports ────────────────────────────────────────────────────
  // Advisory only: `npm start` force-removes stale assessment containers
  // before its own (hard) port check, so a clash from a leftover assessment
  // run resolves itself — but a running platform stack or local process won't.
  ui.step(
    `[3/5] Checking that the stack's host ports are free (Postgres ${pgPort}, emulators 9099/9199/9000, backend 4000)...`,
  );
  const busyPorts = [];
  for (const port of stackPorts(pgPort)) {
    if (portInUse(port)) {
      ui.warn(`Port ${port} is already in use.`);
      ui.note(diagnosePortConflict(port, pgPort).join('\n'), `Free port ${port}`);
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
  ui.step('[4/5] Installing dependencies and building platform libraries (this can take a few minutes)...');
  const installStatus = run([...npmCli(), 'install'], { cwd: REPO_ROOT });
  if (installStatus !== 0) {
    ui.error('npm install failed — fix the error above and re-run npm run setup.');
    process.exitCode = installStatus;
    return;
  }
  // A fresh clone starts this command on the plain UI; the install above just
  // made the rich one available — upgrade for the rest of the run.
  if (!ui.rich) ui = await loadUi();
  const buildStatus = run(
    [
      ...npmCli(),
      'run',
      'build',
      '--',
      '--filter=@roar-platform/api-contract',
      '--filter=@roar-platform/assessment-schema',
      '--filter=@roar-platform/scoring-tables',
      '--filter=@roar-platform/assessment-sdk',
    ],
    { cwd: REPO_ROOT },
  );
  if (buildStatus !== 0) {
    ui.error('The platform library build failed — fix the error above and re-run npm run setup.');
    process.exitCode = buildStatus;
    return;
  }
  ui.success('Dependencies installed and platform libraries built.');

  // ── 5. taskVariantParameters.json ──────────────────────────────────────────
  ui.step('[5/5] Setting up taskVariantParameters.json...');
  if (existsSync(PARAMS_FILE)) {
    ui.success('taskVariantParameters.json already exists — leaving it untouched.');
  } else if (existsSync(PARAMS_EXAMPLE_FILE)) {
    copyFileSync(PARAMS_EXAMPLE_FILE, PARAMS_FILE);
    ui.success('Created taskVariantParameters.json from the example.');
  } else {
    ui.warn('No taskVariantParameters.example.json found in this directory.');
    warnings.push("Create taskVariantParameters.json manually before running 'npm start'.");
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  if (warnings.length > 0) {
    ui.note(warnings.map((w) => `- ${w}`).join('\n'), "Resolve these before running 'npm start'");
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
