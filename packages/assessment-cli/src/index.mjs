/**
 * Entry point for the assessment environment CLI, invoked from each
 * assessment package's npm scripts as:
 *
 *   node ../../../packages/assessment-cli/src/index.mjs <command> [args]
 *
 * Commands map 1:1 to the npm scripts: setup, start, stop, restart,
 * seed-tasks, rebuild, predev. Extra args are forwarded to the command
 * (e.g. `npm run seed:tasks -- --refresh-params`).
 */
import { loadUi } from './ui.mjs';

const COMMANDS = {
  setup: async () => (await import('./commands/setup.mjs')).setup,
  start: async () => (await import('./commands/start.mjs')).start,
  stop: async () => (await import('./commands/stop.mjs')).stop,
  restart: async () => (await import('./commands/restart.mjs')).restart,
  'seed-tasks': async () => (await import('./commands/seed-tasks.mjs')).seedTasks,
  rebuild: async () => (await import('./commands/rebuild.mjs')).rebuild,
  predev: async () => (await import('./commands/predev.mjs')).predev,
};

const [command, ...args] = process.argv.slice(2);

if (!command || !(command in COMMANDS)) {
  console.error(`Unknown command: ${command ?? '(none)'}`);
  console.error(`Usage: assessment-cli <${Object.keys(COMMANDS).join('|')}> [args]`);
  process.exit(1);
}

const ui = await loadUi();
try {
  const handler = await COMMANDS[command]();
  await handler(ui, args);
} catch (error) {
  // Last-resort handler: every expected failure sets process.exitCode with a
  // curated message; anything landing here is a CLI bug worth the stack trace.
  ui.error(error?.stack ?? String(error));
  process.exitCode = 1;
}
