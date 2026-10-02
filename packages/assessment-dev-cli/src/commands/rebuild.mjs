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
    ui.note(DOCKER_INSTALL_LINES.join('\n'), 'Docker with Compose v2 is required', 'error');
    process.exitCode = 1;
    return;
  }
  if (!daemonRunning()) {
    ui.note(DOCKER_DAEMON_LINES.join('\n'), 'Docker is installed but not running', 'error');
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
      'Restarting the environment with the new images (your database is kept; sign-ins and uploaded recordings are reset)...',
    );
    if (!(await composeStreamed(['up', '-d', '--wait'], pgPort, apply.line))) {
      apply.fail('Applying the new images failed.');
      process.exitCode = 1;
      return;
    }
    apply.done('Environment updated.');
  }

  ui.success('Rebuild complete.');
}
