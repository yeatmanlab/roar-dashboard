import type { CommandContext } from '../command/command';
import { SDKError } from '../errors/sdk-error';
import type {
  StartRunInput,
  FinishRunInput,
  FinishRunOutput,
  UpdateEngagementFlagsInput,
  UpdateEngagementFlagsOutput,
  AddInteractionInput,
  AddInteractionOutput,
  UpdateUserInput,
  UpdateUserOutput,
  TrialData,
  RawScores,
  ComputedScores,
  WriteTrialOutput,
} from '../types';
import { Invoker } from '../command/invoker';
import { RoarApi } from '../receiver/roar-api';
import { StartRunCommand } from '../commands/start-run.command';
import { AbortRunCommand } from '../commands/abort-run.command';

// Module-level state for Firekit compat
let _runId: string | undefined;
let _taskInfo:
  | {
      variantId: string;
      version: string;
      adminId?: string;
      isAnonymous?: boolean;
    }
  | undefined;

// Optional helper if you already have a way to set task info elsewhere.
// If you already have task info in ctx, ignore this and wire that instead.
export function _setTaskInfoForCompat(taskInfo: {
  variantId: string;
  version: string;
  adminId?: string;
  isAnonymous?: boolean;
}): void {
  _taskInfo = taskInfo;
}

function getCtx(): CommandContext {
  try {
    return getFirekitCompat().getContext();
  } catch (err) {
    if (err instanceof SDKError) throw err;
    throw new SDKError('Firekit compat has not been initialized. Call initFirekitCompat() first.');
  }
}

function getInvokerAndApi() {
  const ctx = getCtx();
  const api = new RoarApi(ctx);
  const invoker = new Invoker(ctx);
  return { api, invoker };
}

export function _getRunIdForCompat(): string | undefined {
  return _runId;
}

/**
 * FirekitFacade provides backward compatibility with legacy Firekit-based assessments.
 *
 * This is a Singleton pattern implementation that allows existing assessments
 * to continue working with a familiar API while internally using the new SDK.
 *
 * Usage:
 * - New assessments: Use the native SDK directly (Invoker, RoarApi, etc.)
 * - Legacy assessments: Use FirekitFacade for drop-in compatibility
 *
 * The facade lazy-initializes on first call, allowing the host application
 * to provide the CommandContext bridge without explicit SDK initialization.
 */
export class FirekitFacade {
  private static instance: FirekitFacade | undefined;
  private ctx: CommandContext | undefined;

  private constructor() {}

  /**
   * Returns the singleton instance of FirekitFacade.
   * Creates it on first call.
   */
  static getInstance(): FirekitFacade {
    if (!FirekitFacade.instance) {
      FirekitFacade.instance = new FirekitFacade();
    }
    return FirekitFacade.instance;
  }

  /**
   * Initializes the facade with SDK configuration.
   * Called by initFirekitCompat() to set up the CommandContext.
   *
   * @param ctx - CommandContext with baseUrl, auth, and other SDK config
   */
  initialize(ctx: CommandContext): void {
    this.ctx = ctx;

    // Reset compat state on re-init to avoid leaking state across tests / consumers
    _runId = undefined;
    _taskInfo = undefined;
  }

  /**
   * Returns the initialized CommandContext.
   * Throws if initialize() has not been called.
   *
   * @returns CommandContext for use by legacy assessments
   * @throws Error if facade not initialized
   */
  getContext(): CommandContext {
    if (!this.ctx) {
      throw new Error('FirekitFacade not initialized. Call initFirekitCompat() first.');
    }
    return this.ctx;
  }
}

/**
 * Initializes the Firekit compatibility facade.
 * Should be called once by the host application with the SDK configuration.
 *
 * @param ctx - CommandContext with baseUrl, auth callbacks, and optional logger
 * @returns FirekitFacade singleton instance
 *
 * Example:
 * ```
 * const firekit = initFirekitCompat({
 *   baseUrl: 'https://api.example.com',
 *   auth: { getToken: () => Promise.resolve(token) }
 * });
 * ```
 */
export function initFirekitCompat(ctx: CommandContext): FirekitFacade {
  const facade = FirekitFacade.getInstance();
  facade.initialize(ctx);
  return facade;
}

/**
 * Retrieves the initialized Firekit facade instance.
 * Can be called from anywhere in the application after initFirekitCompat().
 *
 * @returns FirekitFacade singleton instance
 */
export function getFirekitCompat(): FirekitFacade {
  return FirekitFacade.getInstance();
}

/**
 * Firekit compatibility method for starting a new assessment run.
 *
 * This function initiates a new run in the ROAR backend system, supporting both
 * anonymous and authenticated assessment modes. It serves as a drop-in replacement
 * for the legacy Firekit `appkit.startRun()` method.
 *
 * The function validates that:
 * - Task information (variantId, taskVersion) has been set via _setTaskInfoForCompat()
 * - If isAnonymous is false, administrationId must be provided
 *
 * The created runId is stored internally for use by subsequent operations like
 * writeTrial() and finishRun().
 *
 * @param additionalRunMetadata - Optional custom metadata to include with the run.
 *                                Can contain any key-value pairs for run customization.
 *
 * @returns Promise<void> - Resolves when the run is successfully created
 *
 * @throws SDKError if task info is not set or if administrationId is required but missing
 *
 * @example
 * ```ts
 * // Anonymous run
 * _setTaskInfoForCompat({
 *   variantId: 'variant-123',
 *   version: '1.0.0',
 *   isAnonymous: true
 * });
 * await startRun({ sessionId: 'session-456' });
 *
 * // Authenticated run
 * _setTaskInfoForCompat({
 *   variantId: 'variant-123',
 *   version: '1.0.0',
 *   adminId: 'admin-789',
 *   isAnonymous: false
 * });
 * await startRun({ userId: 'user-123' });
 * ```
 */
export async function startRun(additionalRunMetadata?: Record<string, unknown>): Promise<void> {
  if (!_taskInfo) {
    throw new SDKError('appkit.startRun missing task info (variantId/taskVersion/administrationId).');
  }

  const isAnonymous = !!_taskInfo.isAnonymous;

  if (!isAnonymous && !_taskInfo.adminId) {
    throw new SDKError('appkit.startRun requires administrationId when isAnonymous is false.');
  }

  const { api, invoker } = getInvokerAndApi();

  const base = {
    type: 'start' as const,
    variantId: _taskInfo.variantId,
    taskVersion: _taskInfo.version,
    ...(additionalRunMetadata ? { metadata: additionalRunMetadata } : {}),
  };

  const input: StartRunInput = isAnonymous
    ? { ...base, isAnonymous: true }
    : { ...base, isAnonymous: false, administrationId: _taskInfo.adminId as string };

  const cmd = new StartRunCommand(api);
  const result = await invoker.run(cmd, input);

  _runId = result.runId;
}

/**
 * Firekit compatibility stub.
 *
 * From @bdelab/roar-firekit:
 * async finishRun(finishingMetaData: { [key: string]: unknown } = {}) { […] }
 *
 * @param finishingMetaData - Optional finishing metadata for the run.
 * @returns Promise<void>
 * @throws SdkError - Always, until implemented.
 */
export async function finishRun(finishingMetaData: FinishRunInput = {}): Promise<FinishRunOutput> {
  void finishingMetaData;
  throw new SDKError('appkit.finishRun not yet implemented');
}

/**
 * Firekit compatibility method for aborting an active assessment run.
 *
 * This function provides a drop-in replacement for the legacy Firekit `appkit.abortRun()` method.
 * It sends an abort event to the ROAR backend to terminate the current assessment run.
 *
 * The function maintains the original Firekit synchronous signature while performing the
 * abort operation asynchronously in the background (fire-and-forget pattern). This ensures
 * backward compatibility with existing assessments that expect a synchronous call.
 *
 * Behavior:
 * - If no run has been started (no _runId), the function returns immediately without error
 * - If a run is active, an abort event is posted to the backend asynchronously
 * - Errors during the abort operation are logged but not thrown (to preserve sync signature)
 * - The function returns immediately; the actual abort may complete later
 *
 * From @bdelab/roar-firekit:
 * ```ts
 * abortRun() { […] }
 * ```
 *
 * @returns void - Returns immediately; abort operation completes asynchronously
 *
 * @example
 * ```ts
 * // Start a run
 * await startRun();
 *
 * // Later, abort the run
 * abortRun(); // Returns immediately, abort happens in background
 * ```
 *
 * @see AbortRunCommand for the underlying command implementation
 * @see postRunEvent for the API method used to send the abort event
 */
export function abortRun(): void {
  // If run never started, nothing to abort server-side.
  if (!_runId) return;

  // Fire-and-forget to preserve sync Firekit signature.
  void (async () => {
    const { api, invoker } = getInvokerAndApi();
    const cmd = new AbortRunCommand(api);
    await invoker.run(cmd, { runId: _runId as string, type: 'abort' });
  })().catch((err) => {
    // Don't throw (sync signature). Log if available.
    const ctx = (() => {
      try {
        return getCtx();
      } catch {
        return undefined;
      }
    })();
    ctx?.logger?.warn?.('[firekit.abortRun] Failed to abort run on backend:', err);
  });
}

/**
 * Firekit compatibility stub.
 *
 * From @bdelab/roar-firekit:
 * async updateEngagementFlags(flagNames: string[], markAsReliable = false, reliableByBlock = undefined) { […] }
 *
 * @param flagNames - Array of engagement flag names to update.
 * @param markAsReliable - Whether to mark the run as reliable (default: false).
 * @param reliableByBlock - Optional block-level reliability data.
 * @returns Promise<void>
 * @throws SDKError - Always, until implemented.
 */
export async function updateEngagementFlags({
  flagNames,
  markAsReliable = false,
  reliableByBlock = undefined,
}: UpdateEngagementFlagsInput): UpdateEngagementFlagsOutput {
  void flagNames;
  void markAsReliable;
  void reliableByBlock;
  throw new SDKError('appkit.updateEngagementFlags not yet implemented');
}

/**
 * Firekit compatibility stub.
 *
 * From @bdelab/roar-firekit:
 * addInteraction(interaction: InteractionEvent) { […] }
 *
 * @param interaction - The interaction event to record.
 * @returns void
 * @throws SDKError - Always, until implemented.
 */
export function addInteraction(interaction: AddInteractionInput): AddInteractionOutput {
  void interaction;
  throw new SDKError('appkit.addInteraction not yet implemented');
}

/**
 * Firekit compatibility stub.
 *
 * From @bdelab/roar-firekit:
 * async updateUser({ tasks, variants, assessmentPid, ...userMetadata }: UserUpdateInput): Promise<void> { […] }
 *
 * @deprecated This method is related to standalone apps and may be deprecated in the future.
 * @param userUpdateData - User update data including tasks, variants, assessmentPid, and other metadata.
 * @returns Promise<void>
 * @throws SDKError - Always, until implemented.
 */
export async function updateUser(userUpdateData: UpdateUserInput): UpdateUserOutput {
  // Issue deprecation warning
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[DEPRECATION] updateUser() exists only for Firekit compatibility and will be removed in a future version.',
    );
  }

  void userUpdateData;
  throw new SDKError('appkit.updateUser not yet implemented');
}

/**
 * Firekit compatibility stub.
 *
 * From @bdelab/roar-firekit:
 * async writeTrial(trialData: TrialData, computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>) { […] }
 *
 * Writes trial data to the backend and optionally computes scores via callback.
 *
 * @param trialData - Trial data object containing assessment-specific trial information
 * @param computedScoreCallback - Optional callback function that receives raw scores and returns computed scores
 * @returns Promise<void>
 * @throws SDKError - Always, until implemented.
 */
export async function writeTrial(
  trialData: TrialData,
  computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>,
): WriteTrialOutput {
  void trialData;
  void computedScoreCallback;
  throw new SDKError('appkit.writeTrial not yet implemented');
}
