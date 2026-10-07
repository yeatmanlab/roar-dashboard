/**
 * `npm run restart` — tear the environment down (deleting the local database)
 * and bring it back up.
 *
 * Unlike a plain `npm run stop && npm run start`, this confirms the
 * destructive teardown ONCE and, on decline, aborts cleanly — nothing is torn
 * down, nothing is started, and it exits 0 so npm prints no "lifecycle script
 * failed" noise.
 */
import { start } from './start.mjs';
import { confirmTeardown, stop } from './stop.mjs';

export async function restart(ui, args = []) {
  if (!(await confirmTeardown(ui, args))) {
    ui.outro('Aborted — nothing changed; the environment is untouched and your data is intact.');
    return;
  }

  // Already confirmed: tear down without re-prompting, then start.
  await stop(ui, ['--yes']);
  if (process.exitCode) return;
  await start(ui);
}
