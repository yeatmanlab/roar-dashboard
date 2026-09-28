/**
 * `npm run rebuild` — rebuild the assessment Docker images and, when the stack
 * is running, apply them.
 *
 * The build is cached — routine post-pull rebuilds take seconds. Pass
 * --no-cache for the rare case where a cached layer is wrong (e.g. a registry
 * package republished under the same version):
 *   npm run rebuild -- --no-cache
 */
import { resolvePgPort } from '../context.mjs';
import { compose, composeAvailable, containerRunning, daemonRunning } from '../docker.mjs';
import { DOCKER_DAEMON_LINES, DOCKER_INSTALL_LINES } from '../help.mjs';

export async function rebuild(ui, args = []) {
  if (!composeAvailable()) {
    ui.error('Docker with Compose v2 is required.');
    ui.note(DOCKER_INSTALL_LINES.join('\n'), 'Install Docker');
    process.exitCode = 1;
    return;
  }
  if (!daemonRunning()) {
    ui.error('Docker is installed but not running.');
    ui.note(DOCKER_DAEMON_LINES.join('\n'), 'Start Docker');
    process.exitCode = 1;
    return;
  }

  const pgPort = resolvePgPort();
  const noCache = args.includes('--no-cache');
  ui.step(noCache ? 'Rebuilding assessment Docker images (no cache)...' : 'Rebuilding assessment Docker images...');
  if (!compose(['build', ...(noCache ? ['--no-cache'] : [])], pgPort).ok) {
    process.exitCode = 1;
    return;
  }

  // Fresh images do nothing while old containers keep running — `npm start`
  // takes its already-running fast path and never recreates them. Apply the
  // images now: compose recreates only services whose image changed and the
  // database volume survives. The emulator container restarting does clear its
  // in-memory auth users and recordings (this stack does not persist emulator
  // state).
  if (containerRunning('assessment-backend')) {
    ui.step(
      'Applying the new images to the running stack (database data survives; emulator auth users/recordings are in-memory and reset)...',
    );
    if (!compose(['up', '-d', '--wait'], pgPort).ok) {
      process.exitCode = 1;
      return;
    }
  }

  ui.success('Rebuild complete.');
}
