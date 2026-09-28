/**
 * `npm stop` — stop the shared assessment infrastructure and remove all
 * associated volumes.
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
 * Confirms the irreversible teardown (deletes the DB volume, losing every
 * run/trial/score/recording). Skipped with -y/--yes/--force or on a non-TTY
 * (CI, pipes), where it proceeds without asking.
 *
 * @returns {Promise<boolean>} True to proceed.
 */
export async function confirmTeardown(ui, args) {
  if (hasYesFlag(args)) return true;
  ui.warn(TEARDOWN_WARNING);
  return ui.confirm('Continue?', { nonTtyValue: true });
}

export async function stop(ui, args = []) {
  // Declining is a valid choice, not an error — exit 0, or npm prints a
  // misleading "lifecycle script failed" wrapper. `restart` runs its own
  // confirm and calls this with --yes, so this prompt fires only for a bare
  // `stop`.
  if (!(await confirmTeardown(ui, args))) {
    ui.outro('Aborted — the local database was left intact.');
    return;
  }

  const pgPort = resolvePgPort();
  ui.step('Stopping the assessment environment...');

  // --timeout 0 sends SIGKILL immediately instead of waiting for graceful shutdown.
  if (compose(['down', '-v', '--remove-orphans', '--timeout', '0'], pgPort, { quiet: true }).ok) {
    ui.success('Assessment environment stopped and local data deleted.');
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
    ui.error('Some containers could not be stopped (Linux AppArmor restriction).');
    ui.note(`sudo kill -9 ${failedPids.join(' ')}`, 'Run this, then retry');
    process.exitCode = 1;
    return;
  }

  // Give Docker a moment to notice the processes are gone, then clean up.
  sleep(1000);
  compose(['down', '-v', '--remove-orphans', '--timeout', '0'], pgPort, { quiet: true });
  capture(['docker', 'rm', '-f', ...CONTAINERS]);
  // If the retried compose down above also failed, this is the only removal of
  // the data volume — without it the "deletes the local database" contract
  // breaks. The legacy pre-Postgres-18 name is included as cheap insurance for
  // checkouts that ran the old stack: compose down -v only removes volumes the
  // current file declares, so nothing else ever deletes it.
  capture(['docker', 'volume', 'rm', 'roar-assessment_postgres-18-data', 'roar-assessment_pgdata']);

  ui.success('Assessment environment stopped.');
}
