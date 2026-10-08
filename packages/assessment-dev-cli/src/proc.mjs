/** Subprocess helpers shared by every command. */
import { spawn, spawnSync } from 'node:child_process';

/**
 * The npm to use for nested npm calls. When npm runs a lifecycle script it
 * prepends every ancestor node_modules/.bin to PATH, which can shadow `npm`
 * itself with an old vendored copy — this repo transitively pulls npm@5 via
 * @bdelab/jscat → optimization-js → semantic-release-cli, hoisted to the root
 * node_modules/.bin/npm. npm sets npm_execpath/npm_node_execpath for the run,
 * so nested calls can target the real npm. Outside `npm run`, PATH is not
 * shadowed and the plain binary is fine.
 *
 * @returns {string[]} Command prefix, e.g. ['/usr/bin/node', '/usr/lib/npm-cli.js'] or ['npm'].
 */
export function npmCli() {
  if (process.env.npm_execpath && process.env.npm_node_execpath) {
    return [process.env.npm_node_execpath, process.env.npm_execpath];
  }
  return [process.platform === 'win32' ? 'npm.cmd' : 'npm'];
}

/**
 * Runs a command with output streamed to the terminal.
 *
 * @param {string[]} command - Command and arguments as one array.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {object} [options.env] - Extra environment variables (merged over process.env).
 * @returns {number} The exit code (1 when the process failed to spawn).
 */
export function run(command, { cwd, env } = {}) {
  const [cmd, ...args] = command;
  const result = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

/**
 * Runs a command silently and captures stdout.
 *
 * @param {string[]} command - Command and arguments as one array.
 * @param {object} [options]
 * @param {object} [options.env] - Extra environment variables (merged over process.env).
 * @returns {{ ok: boolean, stdout: string }} ok is true on exit code 0.
 */
export function capture(command, { env } = {}) {
  const [cmd, ...args] = command;
  const result = spawnSync(cmd, args, {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return { ok: result.status === 0, stdout: (result.stdout ?? '').trim() };
}

/**
 * Runs a command with stdout+stderr merged and delivered line-by-line — the
 * feed for ui.task(), which renders a collapsing live tail of the output.
 *
 * @param {string[]} command - Command and arguments as one array.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {object} [options.env] - Extra environment variables (merged over process.env).
 * @param {(line: string) => void} onLine - Receives each output line without its newline.
 * @returns {Promise<number>} The exit code (1 when the process failed to spawn).
 */
export function runStreamed(command, { cwd, env } = {}, onLine) {
  const [cmd, ...args] = command;
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buffer = '';
    const consume = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) onLine(line);
    };
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    child.on('error', () => resolve(1));
    child.on('close', (code) => {
      if (buffer) onLine(buffer);
      resolve(code ?? 1);
    });
  });
}

/**
 * Sleeps synchronously — used only in the teardown fallback, giving Docker a
 * moment to notice killed processes.
 *
 * @param {number} ms - Milliseconds to block.
 */
export function sleep(ms) {
  const buf = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buf), 0, 0, ms);
}
