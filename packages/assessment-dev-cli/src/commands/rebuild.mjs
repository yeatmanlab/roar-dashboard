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
import { composeAvailable, composeStreamed, containerRunning, daemonRunning } from '../docker.mjs';
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
  const build = ui.task(
    noCache ? 'Rebuilding assessment Docker images (no cache)...' : 'Rebuilding assessment Docker images...',
  );
  if (!(await composeStreamed(['build', ...(noCache ? ['--no-cache'] : [])], pgPort, build.line))) {
    build.fail('The image build failed.');
    process.exitCode = 1;
    return;
  }
  build.done('Images rebuilt.');

  // Fresh images do nothing while old containers keep running — `npm start`
  // takes its already-running fast path and never recreates them. Apply the
  // images now: compose recreates only services whose image changed and the
  // database volume survives. The emulator container restarting does clear its
  // in-memory auth users and recordings (this stack does not persist emulator
  // state).
  if (containerRunning('assessment-backend')) {
    const apply = ui.task(
      'Applying the new images to the running stack (database data survives; emulator auth users/recordings are in-memory and reset)...',
    );
    if (!(await composeStreamed(['up', '-d', '--wait'], pgPort, apply.line))) {
      apply.fail('Applying the new images failed.');
      process.exitCode = 1;
      return;
    }
    apply.done('New images applied.');
  }

  ui.success('Rebuild complete.');
}
