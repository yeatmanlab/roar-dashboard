/** Docker predicates, compose helpers, and the port-conflict diagnosis. */
import { COMPOSE_FILE, composeEnv } from './context.mjs';
import { capture, run } from './proc.mjs';

/** True when Docker with Compose v2 is available (client-side check). */
export function composeAvailable() {
  return capture(['docker', 'compose', 'version']).ok;
}

/**
 * True when the Docker daemon is actually running — `docker compose version`
 * succeeds client-side with the daemon stopped, so installed-but-not-launched
 * Docker Desktop passes the availability check and then fails compose with a
 * raw socket error. Check this after availability.
 */
export function daemonRunning() {
  return capture(['docker', 'info']).ok;
}

/**
 * True when the named container is running. The name filter is anchored:
 * Docker's filter is a substring match, so a bare "assessment-db" would also
 * match "assessment-db-migrate".
 *
 * @param {string} name - Exact container name.
 */
export function containerRunning(name) {
  const { ok, stdout } = capture(['docker', 'ps', '--filter', `name=^${name}$`, '--filter', 'status=running', '-q']);
  return ok && stdout.length > 0;
}

/**
 * Runs `docker compose -f <assessment compose file> <args>` with the
 * substitution variables the compose file expects.
 *
 * @param {string[]} args - Compose subcommand and flags.
 * @param {string} pgPort - Resolved Postgres host port.
 * @param {object} [options]
 * @param {boolean} [options.quiet] - Capture output instead of streaming it.
 * @returns {{ ok: boolean, stdout?: string }}
 */
export function compose(args, pgPort, { quiet = false } = {}) {
  const command = ['docker', 'compose', '-f', COMPOSE_FILE, ...args];
  if (quiet) return capture(command, { env: composeEnv(pgPort) });
  return { ok: run(command, { env: composeEnv(pgPort) }) === 0 };
}

/**
 * Diagnoses what is occupying a host port and how to free it. Returns the
 * diagnosis lines — no headline and no exit — so the caller decides whether
 * the conflict is a hard error (start) or an advisory warning (setup). The
 * most common culprits, in order: the platform dev stack, a local process, or
 * another Docker container. Every probe is failure-tolerant: a dead Docker
 * daemon or a missing lsof degrades the diagnosis, it doesn't throw.
 *
 * @param {string} port - The occupied host port.
 * @param {string} pgPort - The stack's Postgres port (gets tailored advice).
 * @returns {string[]} Human-readable diagnosis lines.
 */
export function diagnosePortConflict(port, pgPort) {
  const lines = [];

  // A Docker container publishing the port? Compose labels tell us which stack.
  const container = capture(['docker', 'ps', '--filter', `publish=${port}`, '--format', '{{.Names}}'])
    .stdout.split('\n')[0]
    .trim();
  if (container) {
    const project = capture([
      'docker',
      'inspect',
      '--format',
      '{{index .Config.Labels "com.docker.compose.project"}}',
      container,
    ]).stdout.trim();
    if (project === 'roar-platform') {
      lines.push(
        `The ROAR platform dev stack is running (container: ${container}).`,
        'Stop it first, from the repository root:',
        '  docker compose down',
      );
    } else if (project === 'roar-assessment') {
      lines.push(
        `A previous assessment environment is still partially running (container: ${container}).`,
        'Reset it first:',
        '  npm run stop',
      );
    } else {
      lines.push(`A Docker container is holding the port: ${container}`, 'Stop it with:', `  docker stop ${container}`);
    }
    return lines;
  }

  // Not a container — a host process. Name it before guessing: the Postgres
  // port's usual culprit is a local PostgreSQL install, but pgweb, another
  // stack's DB, or any stray service can hold it too.
  const lsof = capture(['lsof', '-i', `:${port}`, '-sTCP:LISTEN']);
  const holder = lsof.ok
    ? lsof.stdout.split('\n')[1]?.trim().split(/\s+/).slice(0, 2).join(' (pid ').concat(')')
    : undefined;
  if (holder && !holder.startsWith('(')) {
    lines.push(`Held by: ${holder}. Stop that process and retry.`);
  } else {
    lines.push(`Find the process with: lsof -i :${port}  (or: ss -tlnp | grep ${port})`);
    if (port === pgPort) {
      lines.push(
        'A local PostgreSQL instance is a common culprit:',
        '  macOS (Homebrew): brew services stop postgresql@<version>',
        '  Ubuntu/Debian:    sudo systemctl stop postgresql',
      );
    }
  }

  // The Postgres port is the one overridable port, so the clash can also be
  // side-stepped entirely.
  if (port === pgPort) {
    lines.push(`Or pick another port: ASSESSMENT_PG_PORT=<port> npm start`);
  }
  return lines;
}
