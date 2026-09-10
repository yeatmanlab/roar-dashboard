/**
 * FGA tuple sync — Cloud Run Job entrypoint.
 *
 * Run-to-completion process that reconciles the FGA store against the Postgres
 * junction tables via `AuthorizationModule.syncFgaStore`: initialize
 * dependencies, run one sync, log the per-category diff counts, close the
 * pools, exit. Dry run is the default; writes require an explicit `--apply`.
 *
 * This module has no side effects on import; the process entrypoint is
 * `index.ts`.
 *
 * The job runs with a synthetic super-admin auth context — there is no end
 * user, and IAM on the Cloud Run Job execution is the real access control.
 */
import 'dotenv/config';
import type { SyncFgaResponse } from '../../services/authorization/sync/authorization.module';
import { FgaClient } from '../../clients/fga.client';
import { initializeDatabasePools, closeDatabasePools } from '../../db/clients';
import { logger } from '../../logger';
import type { AuthContext } from '../../types/auth-context';

/** Synthetic identity used in log lines and error context. */
const SYNC_JOB_USER_ID = 'system:sync-fga-job';

const APPLY_FLAG = '--apply';

const JOB_USAGE = 'Usage: node dist/jobs/sync-fga.js [--apply]';

/** Result of parsing the job arguments. */
type ParsedArgs = { ok: true; dryRun: boolean } | { ok: false; unknownArg: string };

/**
 * Parse the job arguments into the sync mode.
 *
 * Anything other than `--apply` is an error: a mistyped flag must fail loudly
 * instead of silently downgrading an intended apply into a dry run.
 *
 * @param argv - Process arguments (pass `process.argv`)
 * @returns The parsed mode, or the first unknown token
 */
function parseArgs(argv: readonly string[]): ParsedArgs {
  const args = argv.slice(2);
  const unknownArg = args.find((arg) => arg !== APPLY_FLAG);

  if (unknownArg !== undefined) {
    return { ok: false, unknownArg };
  }

  return { ok: true, dryRun: !args.includes(APPLY_FLAG) };
}

/** Synthetic super-admin context — see the file-level doc for the IAM rationale. */
const SYNC_JOB_AUTH_CONTEXT: AuthContext = {
  userId: SYNC_JOB_USER_ID,
  isSuperAdmin: true,
};

/**
 * Run one FGA sync: initialize dependencies, sync, log the result, close pools.
 *
 * @param options - The parsed sync mode
 * @param options.dryRun - When true, reads FGA and reports diff counts without writing
 * @returns The sync result with per-category write/delete counts
 * @throws {ApiError} When the FGA client is misconfigured or the sync fails
 */
export async function main({ dryRun }: { dryRun: boolean }): Promise<SyncFgaResponse> {
  // Validate the FGA config (env-only, getClient throws on missing vars) before
  // opening any database pool, so a misconfigured store fails before the
  // multi-minute tuple build phase.
  await FgaClient.initialize();
  FgaClient.getClient();

  await initializeDatabasePools();

  try {
    // Dynamic import after pool init — the module graph instantiates
    // repositories at module level (same rationale as server.ts).
    const { AuthorizationModule } = await import('../../services/authorization/sync/authorization.module');

    const module = AuthorizationModule();
    const result = await module.syncFgaStore(SYNC_JOB_AUTH_CONTEXT, { dryRun });

    logger.info(
      {
        dryRun: result.dryRun,
        categories: result.categories,
        totalWrites: result.totalWrites,
        totalDeletes: result.totalDeletes,
      },
      'FGA sync job completed',
    );

    return result;
  } finally {
    try {
      await closeDatabasePools();
    } catch (closeError) {
      // A close failure must not mask the sync outcome or flip the exit code.
      logger.error({ err: closeError }, 'Failed to close database pools after FGA sync job');
    }
  }
}

/**
 * Execute the job and map the outcome to a process exit code.
 *
 * @param argv - Process arguments (pass `process.argv`); `--apply` is the only accepted argument
 * @returns 0 on success, 1 on failure
 */
export async function run(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    logger.fatal({ argument: parsed.unknownArg, usage: JOB_USAGE }, 'FGA sync job rejected an unknown argument');
    return 1;
  }

  try {
    await main({ dryRun: parsed.dryRun });
    return 0;
  } catch (err) {
    logger.fatal({ err }, 'FGA sync job failed');
    return 1;
  }
}
