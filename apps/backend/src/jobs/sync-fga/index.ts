/**
 * Process entrypoint for the FGA sync Cloud Run Job (`node dist/jobs/sync-fga.js`).
 *
 * Separate from `sync-fga.job.ts` so the job module stays importable without
 * side effects, while this entry always executes — no "am I the main module?"
 * heuristic that can silently no-op under a symlinked invocation.
 */
import { run } from './sync-fga.job';

// Exiting right after the awaited run is safe: pino's on-exit hook flushes the
// async destination for main-thread loggers. A worker-thread transport would
// not be covered — flush explicitly before exit if logger.ts ever moves to one.
void run(process.argv).then((exitCode) => process.exit(exitCode));
