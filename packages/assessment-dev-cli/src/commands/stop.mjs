/**
 * `npm stop` — stop the shared assessment infrastructure.
 *
 * The researcher chooses what happens to the local database (runs, trials,
 * scores, recordings): keep it — the default, and what a plain Enter picks —
 * or delete it for a clean slate. Flags skip the question for scripting and
 * for `restart`: `--keep-data` keeps, `-y`/`--yes`/`--force` deletes.
 * Non-interactive runs (CI, pipes) keep the data — the safe direction.
 *
 * Falls back to direct process kills when the Docker API can't stop
 * containers: on some Linux systems AppArmor blocks `docker stop`/`docker
 * kill` with "permission denied"; in that case the exact `sudo kill` command
 * is printed to run manually.
 */
import { resolvePgPort } from '../context.mjs';
import { compose } from '../docker.mjs';
import { hasYesFlag, TEARDOWN_WARNING } from '../help.mjs';
import { capture, sleep } from '../proc.mjs';

const CONTAINERS = ['assessment-backend', 'assessment-db-migrate', 'firebase-emulator', 'assessment-db'];

/**
 * Confirms the irreversible full teardown — used by `restart`, whose purpose
 * is a from-scratch environment. Skipped with -y/--yes/--force or on a
 * non-TTY, where it proceeds.
 *
 * @returns {Promise<boolean>} True to proceed with the wipe.
 */
export async function confirmTeardown(ui, args) {
  if (hasYesFlag(args)) return true;
  ui.warn(TEARDOWN_WARNING);
  return ui.confirm('Continue?', { nonTtyValue: true });
}

export async function stop(ui, args = []) {
  let keepData;
  if (hasYesFlag(args)) {
    keepData = false;
  } else if (args.includes('--keep-data')) {
    keepData = true;
  } else {
    keepData = await ui.confirm('Keep the local database (runs, trials, scores, recordings)?', {
      nonTtyValue: true,
      initialValue: true,
    });
  }

  const pgPort = resolvePgPort();
  ui.step(
    keepData
      ? 'Stopping the assessment environment (keeping the database)...'
      : 'Stopping the assessment environment...',
  );

  const downArgs = ['down', ...(keepData ? [] : ['-v']), '--remove-orphans', '--timeout', '0'];
  const stoppedMessage = keepData
    ? 'Assessment environment stopped — the database was kept. npm start brings it back with your data.'
    : 'Assessment environment stopped and local data deleted.';

  // --timeout 0 sends SIGKILL immediately instead of waiting for graceful shutdown.
  if (compose(downArgs, pgPort, { quiet: true }).ok) {
    if (!keepData) removeLegacyVolumes();
    ui.success(stoppedMessage);
    return;
  }

  ui.warn('docker compose down failed. Falling back to direct process termination...');

  // Disable restart policies before killing so Docker doesn't revive
  // containers after the first kill (restart: unless-stopped would otherwise
  // bring them back).
  for (const container of CONTAINERS) {
    capture(['docker', 'update', '--restart=no', container]);
  }

  const failedPids = [];
  for (const container of CONTAINERS) {
    const pid = Number(capture(['docker', 'inspect', '--format', '{{.State.Pid}}', container]).stdout);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    try {
      process.kill(pid, 'SIGKILL');
      ui.info(`Killed ${container} (pid ${pid})`);
    } catch {
      ui.warn(`Could not kill ${container} (pid ${pid})`);
      failedPids.push(pid);
    }
  }

  if (failedPids.length > 0) {
    ui.note(
      `Run this, then retry:\n  sudo kill -9 ${failedPids.join(' ')}`,
      'Some containers could not be stopped (Linux AppArmor restriction)',
      'error',
    );
    process.exitCode = 1;
    return;
  }

  // Give Docker a moment to notice the processes are gone, then clean up.
  sleep(1000);
  compose(downArgs, pgPort, { quiet: true });
  capture(['docker', 'rm', '-f', ...CONTAINERS]);
  if (!keepData) {
    // If the retried compose down above also failed, this is the only removal
    // of the current data volume — without it the "deletes the local
    // database" contract breaks.
    capture(['docker', 'volume', 'rm', 'roar-assessment-postgres-data']);
    removeLegacyVolumes();
  }

  ui.success(stoppedMessage);
}

/**
 * Removes data volumes from earlier revisions of the stack (the pre-rename
 * auto-prefixed name and the pre-Postgres-18 name). Runs on every delete —
 * `compose down -v` only removes volumes the current file declares, so
 * nothing else ever deletes these.
 */
function removeLegacyVolumes() {
  capture(['docker', 'volume', 'rm', 'roar-assessment_postgres-18-data', 'roar-assessment_pgdata']);
}
