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
import type { Json } from '@roar-dashboard/api-contract';
import { Invoker } from '../command/invoker';
import { RoarApi } from '../receiver/roar-api';
import { StartRunCommand } from '../commands/start-run.command';

type CompatTaskInfo = {
  variantId: string;
  taskVersion: string;
  administrationId?: string;
  isAnonymous?: boolean;
};

// Module-level state for Firekit compat
let _runId: string | undefined;
let _taskInfo: CompatTaskInfo | undefined;

export function _getRunIdForCompat(): string | undefined {
  return _runId;
}

/**
 * Internal helper to retrieve the initialized API and Invoker instances.
 * Ensures that the Firekit compat facade has been properly initialized.
 *
 * @returns Object containing initialized RoarApi and Invoker instances
 * @throws {SDKError} If facade has not been initialized via initFirekitCompat()
 * @internal
 */
function getInvokerAndApi(): { api: RoarApi; invoker: Invoker } {
  const facade = getFirekitCompat();

  return {
    api: facade.getApi(),
    invoker: facade.getInvoker(),
  };
}

/**
 * Test-only function to reset the Firekit compat singleton state.
 * Clears the singleton instance and module-level state variables.
 * @internal
 */
export function _resetFirekitCompat(): void {
  FirekitFacade._resetInstance();
}

/**
 * FirekitFacade provides backward compatibility with legacy Firekit-based assessments.
 *
 * This is a Singleton pattern implementation that allows existing assessments
 * to continue working with a familiar API while internally using the new SDK.
 *
 * **Usage:**
 * - New assessments: Use the native SDK directly (Invoker, RoarApi, etc.)
 * - Legacy assessments: Use FirekitFacade for drop-in compatibility
 *
 * The facade lazy-initializes on first call, allowing the host application
 * to provide the CommandContext bridge without explicit SDK initialization.
 *
 * @example
 * ```ts
 * const facade = initFirekitCompat(ctx, { variantId: 'v1', taskVersion: '1.0' });
 * const api = facade.getApi();
 * const invoker = facade.getInvoker();
 * ```
 */
export class FirekitFacade {
  private static instance: FirekitFacade | undefined;
  private ctx: CommandContext | undefined;
  private api: RoarApi | undefined;
  private invoker: Invoker | undefined;

  private constructor() {}

  /**
   * Returns the singleton instance of FirekitFacade.
   * Creates it on first call.
   *
   * @returns FirekitFacade singleton instance
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
   * Resets module-level state on re-initialization to prevent state leakage between tests or consumers.
   *
   * @param ctx - CommandContext with baseUrl, auth callbacks, and optional logger
   * @param taskInfo - Task information including variantId, taskVersion, administrationId, and isAnonymous flag
   */
  initialize(ctx: CommandContext, taskInfo: CompatTaskInfo): void {
    this.ctx = ctx;
    this.api = new RoarApi(ctx);
    this.invoker = new Invoker(ctx);

    // Reset compat state on re-init to avoid leaking state across tests / consumers
    _runId = undefined;
    _taskInfo = taskInfo;
  }

  /**
   * Returns the initialized CommandContext.
   * Throws if initialize() has not been called.
   *
   * @returns CommandContext for use by legacy assessments
   * @throws {SDKError} If facade not initialized
   */
  getContext(): CommandContext {
    if (!this.ctx) {
      throw new SDKError('FirekitFacade not initialized. Call initFirekitCompat() first.');
    }
    return this.ctx;
  }

  /**
   * Returns the initialized RoarApi instance.
   * Throws if initialize() has not been called.
   *
   * @returns RoarApi instance for making API requests
   * @throws {SDKError} If facade not initialized
   */
  getApi(): RoarApi {
    if (!this.api) {
      throw new SDKError('Firekit compat has not been initialized. Call initFirekitCompat() first.');
    }
    return this.api;
  }

  /**
   * Returns the initialized Invoker instance.
   * Throws if initialize() has not been called.
   *
   * @returns Invoker instance for executing commands
   * @throws {SDKError} If facade not initialized
   */
  getInvoker(): Invoker {
    if (!this.invoker) {
      throw new SDKError('Firekit compat has not been initialized. Call initFirekitCompat() first.');
    }
    return this.invoker;
  }

  /**
   * Test-only method to reset the singleton instance.
   * Used in tests to ensure clean state between test cases.
   * @internal
   */
  static _resetInstance(): void {
    FirekitFacade.instance = undefined;
    _runId = undefined;
    _taskInfo = undefined;
  }
}

/**
 * Initializes the Firekit compatibility facade.
 * Should be called once by the host application with the SDK configuration.
 *
 * @param ctx - CommandContext with baseUrl, auth callbacks, and optional logger
 * @param taskInfo - Task information including variantId, taskVersion, administrationId, and isAnonymous flag
 * @returns FirekitFacade singleton instance
 *
 * @example
 * ```ts
 * const firekit = initFirekitCompat(
 *   {
 *     baseUrl: 'https://api.example.com',
 *     auth: { getToken: () => Promise.resolve(token) }
 *   },
 *   {
 *     variantId: 'variant-123',
 *     taskVersion: '1.0.0',
 *     administrationId: 'admin-456',
 *     isAnonymous: false
 *   }
 * );
 * ```
 */
export function initFirekitCompat(ctx: CommandContext, taskInfo: CompatTaskInfo): FirekitFacade {
  const facade = FirekitFacade.getInstance();
  facade.initialize(ctx, taskInfo);
  return facade;
}

/**
 * Retrieves the initialized Firekit facade instance.
 * Can be called from anywhere in the application after initFirekitCompat().
 *
 * @returns FirekitFacade singleton instance
 * @throws {Error} If facade has not been initialized
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
 * **Validation:**
 * - Task information (variantId, taskVersion) must be set via initFirekitCompat()
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
 * @throws {SDKError} If task info is not set or if administrationId is required but missing
 *
 * @example
 * ```ts
 * // Anonymous run
 * initFirekitCompat(
 *   { baseUrl: 'https://api.example.com', auth: { getToken: () => Promise.resolve(token) } },
 *   {
 *     variantId: 'variant-123',
 *     taskVersion: '1.0.0',
 *     isAnonymous: true
 *   }
 * );
 * await startRun({ sessionId: 'session-456' });
 *
 * // Authenticated run
 * initFirekitCompat(
 *   { baseUrl: 'https://api.example.com', auth: { getToken: () => Promise.resolve(token) } },
 *   {
 *     variantId: 'variant-123',
 *     taskVersion: '1.0.0',
 *     administrationId: 'admin-789',
 *     isAnonymous: false
 *   }
 * );
 * await startRun({ userId: 'user-123' });
 * ```
 */
export async function startRun(additionalRunMetadata?: Record<string, unknown>): Promise<void> {
  if (!_taskInfo) {
    throw new SDKError(
      'appkit.startRun missing task info (variantId/taskVersion). administrationId is required only when isAnonymous is false.',
    );
  }

  const isAnonymous = _taskInfo.isAnonymous === true;

  if (!isAnonymous && !_taskInfo.administrationId) {
    throw new SDKError('appkit.startRun requires administrationId when isAnonymous is false.');
  }

  const { api, invoker } = getInvokerAndApi();

  const input: StartRunInput = isAnonymous
    ? {
        variantId: _taskInfo.variantId,
        taskVersion: _taskInfo.taskVersion,
        ...(additionalRunMetadata ? { metadata: additionalRunMetadata as Json } : {}),
        isAnonymous: true,
      }
    : {
        variantId: _taskInfo.variantId,
        taskVersion: _taskInfo.taskVersion,
        administrationId: _taskInfo.administrationId as string,
        ...(additionalRunMetadata ? { metadata: additionalRunMetadata as Json } : {}),
        isAnonymous: false,
      };

  const cmd = new StartRunCommand(api);
  const result = await invoker.run(cmd, input);

  _runId = result.runId;
}

/**
 * Firekit compatibility stub for finishing a run.
 *
 * From @bdelab/roar-firekit:
 * async finishRun(finishingMetaData: { [key: string]: unknown } = {}) { […] }
 *
 * @param finishingMetaData - Optional finishing metadata for the run.
 * @returns Promise<void>
 * @throws {SDKError} Always, until implemented.
 */
export async function finishRun(finishingMetaData: FinishRunInput = {}): Promise<FinishRunOutput> {
  void finishingMetaData;
  throw new SDKError('appkit.finishRun not yet implemented');
}

/**
 * Firekit compatibility stub for aborting a run.
 *
 * From @bdelab/roar-firekit:
 * ```ts
 * abortRun() { […] }
 * ```
 *
 * @returns void
 * @throws {SDKError} Always, until implemented.
 */
export function abortRun(): void {
  if (!_runId) return;

  void (async () => {
    const ctx = getCtx();
    const api = new RoarApi(ctx);

    // Best-effort, no-retry abort to avoid keeping processes alive
    const invoker = new Invoker(ctx, { retries: 0, retryDelayMs: 0 });

    const cmd = new AbortRunCommand(api);
    await invoker.run(cmd, { runId: _runId, type: RUN_EVENT_ABORT });
  })().catch((err) => {
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
 * Firekit compatibility stub for updating engagement flags.
 *
 * From @bdelab/roar-firekit:
 * async updateEngagementFlags(flagNames: string[], markAsReliable = false, reliableByBlock = undefined) { […] }
 *
 * @param flagNames - Array of engagement flag names to update.
 * @param markAsReliable - Whether to mark the run as reliable (default: false).
 * @param reliableByBlock - Optional block-level reliability data.
 * @returns Promise<void>
 * @throws {SDKError} Always, until implemented.
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
 * Firekit compatibility stub for recording an interaction.
 *
 * From @bdelab/roar-firekit:
 * addInteraction(interaction: InteractionEvent) { […] }
 *
 * @param interaction - The interaction event to record.
 * @returns void
 * @throws {SDKError} Always, until implemented.
 */
export function addInteraction(interaction: AddInteractionInput): AddInteractionOutput {
  void interaction;
  throw new SDKError('appkit.addInteraction not yet implemented');
}

/**
 * Firekit compatibility stub for updating user data.
 *
 * From @bdelab/roar-firekit:
 * async updateUser({ tasks, variants, assessmentPid, ...userMetadata }: UserUpdateInput): Promise<void> { […] }
 *
 * @deprecated This method is related to standalone apps and may be deprecated in the future.
 * @param userUpdateData - User update data including tasks, variants, assessmentPid, and other metadata.
 * @returns Promise<void>
 * @throws {SDKError} Always, until implemented.
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
 * Firekit compatibility stub for writing trial data.
 *
 * From @bdelab/roar-firekit:
 * async writeTrial(trialData: TrialData, computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>) { […] }
 *
 * Writes trial data to the backend and optionally computes scores via callback.
 *
 * @param trialData - Trial data object containing assessment-specific trial information
 * @param computedScoreCallback - Optional callback function that receives raw scores and returns computed scores
 * @returns Promise<void>
 * @throws {SDKError} Always, until implemented.
 */
export async function writeTrial(
  trialData: TrialData,
  computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>,
): WriteTrialOutput {
  void trialData;
  void computedScoreCallback;
  throw new SDKError('appkit.writeTrial not yet implemented');
}
