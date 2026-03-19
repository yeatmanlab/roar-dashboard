import type { CommandContext } from '../command/command';
import { SDKError } from '../errors/sdk-error';
import type {
  StartRunInput,
  FinishRunInput,
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
import { RUN_EVENT_ABORT } from '../types/abort-run';
import { RUN_EVENT_COMPLETE } from '../types/finish-run';
import { RUN_EVENT_TRIAL } from '../types/write-trial';
import type { Json } from '@roar-dashboard/api-contract';
import { Invoker } from '../command/invoker';
import { RoarApi } from '../receiver/roar-api';
import { StartRunCommand } from '../commands/start-run.command';
import { AbortRunCommand } from '../commands/abort-run.command';
import { FinishRunCommand } from '../commands/finish-run.command';
import { WriteTrialCommand } from '../commands/write-trial.command';

type CompatTaskInfo = {
  variantId: string;
  taskVersion: string;
  administrationId?: string;
  isAnonymous?: boolean;
};

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
  private runId: string | undefined;
  private taskInfo: CompatTaskInfo | undefined;

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
   * Resets instance state on re-initialization to prevent state leakage between tests or consumers.
   *
   * @param ctx - CommandContext with baseUrl, auth callbacks, and optional logger
   * @param taskInfo - Task information including variantId, taskVersion, administrationId, and isAnonymous flag
   */
  initialize(ctx: CommandContext, taskInfo: CompatTaskInfo): void {
    this.ctx = ctx;
    this.api = new RoarApi(ctx);
    this.invoker = new Invoker(ctx);

    // Reset compat state on re-init to avoid leaking state across tests / consumers
    this.runId = undefined;
    this.taskInfo = taskInfo;
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
  }

  /**
   * Internal getter for the current runId.
   * @internal
   */
  _getRunId(): string | undefined {
    return this.runId;
  }

  /**
   * Internal setter for the runId.
   * @internal
   */
  _setRunId(runId: string): void {
    this.runId = runId;
  }

  /**
   * Internal getter for task info.
   * @internal
   */
  _getTaskInfo(): CompatTaskInfo | undefined {
    return this.taskInfo;
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
 * Retrieves the Firekit facade singleton instance.
 * Can be called from anywhere in the application. The instance is created on first call
 * if it doesn't exist, but will not be properly initialized until initFirekitCompat() is called.
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
 * **Initialization requirement:**
 * - `initFirekitCompat()` must be called before invoking this function
 *
 * **Validation:**
 * - If `isAnonymous` is false, `administrationId` must be provided
 *
 * The created `runId` is stored internally on the facade for use by subsequent
 * operations like `writeTrial()` and `finishRun()`.
 *
 * @param additionalRunMetadata - Optional custom metadata to include with the run.
 *                                Can contain any key-value pairs for run customization.
 *
 * @returns Promise<void> - Resolves when the run is successfully created
 *
 * @throws {SDKError}
 * - If the facade has not been initialized via `initFirekitCompat()`
 * - If `administrationId` is required but missing
 *
 * @example
 * ```ts
 * // Anonymous run
 * initFirekitCompat(ctx, {
 *   variantId: 'variant-123',
 *   taskVersion: '1.0.0',
 *   isAnonymous: true
 * });
 *
 * await startRun({ sessionId: 'session-456' });
 *
 * // Authenticated run
 * initFirekitCompat(ctx, {
 *   variantId: 'variant-123',
 *   taskVersion: '1.0.0',
 *   administrationId: 'admin-789',
 *   isAnonymous: false
 * });
 *
 * await startRun({ userId: 'user-123' });
 * ```
 */
export async function startRun(additionalRunMetadata?: Record<string, unknown>): Promise<void> {
  const facade = getFirekitCompat();
  const taskInfo = facade._getTaskInfo();

  if (!taskInfo) {
    throw new SDKError('appkit.startRun requires initialization. Call initFirekitCompat() first.');
  }

  const isAnonymous = taskInfo.isAnonymous === true;

  if (!isAnonymous && !taskInfo.administrationId) {
    throw new SDKError('appkit.startRun requires administrationId when isAnonymous is false.');
  }

  const api = facade.getApi();
  const invoker = facade.getInvoker();

  const input: StartRunInput = isAnonymous
    ? {
        variantId: taskInfo.variantId,
        taskVersion: taskInfo.taskVersion,
        ...(additionalRunMetadata ? { metadata: additionalRunMetadata as Json } : {}),
        isAnonymous: true,
      }
    : {
        variantId: taskInfo.variantId,
        taskVersion: taskInfo.taskVersion,
        administrationId: taskInfo.administrationId as string,
        ...(additionalRunMetadata ? { metadata: additionalRunMetadata as Json } : {}),
        isAnonymous: false,
      };

  const cmd = new StartRunCommand(api);
  const result = await invoker.run(cmd, input);

  facade._setRunId(result.runId);
}

/**
 * Firekit compatibility method for finishing an assessment run.
 *
 * This function marks a run as complete in the ROAR backend system, serving as a drop-in
 * replacement for the legacy Firekit `appkit.finishRun()` method.
 *
 * **Initialization requirement:**
 * - `initFirekitCompat()` must be called before invoking this function
 * - `startRun()` must be called to create an active run
 *
 * The run is marked with a completion event and any provided metadata is included
 * in the backend request.
 *
 * @param finishingMetadata - Optional custom metadata to include with the completion event.
 *                            Can contain any key-value pairs for run customization.
 *
 * @returns Promise<void> - Resolves when the run is successfully marked as complete
 *
 * @throws {SDKError}
 * - If the facade has not been initialized via `initFirekitCompat()`
 * - If no active run exists (i.e., `startRun()` has not been called)
 * - If the backend request fails
 *
 * @example
 * ```ts
 * initFirekitCompat(ctx, {
 *   variantId: 'variant-123',
 *   taskVersion: '1.0.0',
 *   isAnonymous: true
 * });
 *
 * await startRun();
 * // ... assessment logic ...
 * await finishRun({ totalScore: 85, timeSpent: 300 });
 * ```
 */
export async function finishRun(finishingMetadata?: Record<string, unknown>): Promise<void> {
  const facade = getFirekitCompat();
  const runId = facade._getRunId();

  if (!runId) {
    throw new SDKError('appkit.finishRun requires an active run. Call appkit.startRun() first.');
  }

  const api = facade.getApi();
  const invoker = facade.getInvoker();

  const input: FinishRunInput = {
    runId,
    type: RUN_EVENT_COMPLETE,
    ...(finishingMetadata ? { metadata: finishingMetadata as Json } : {}),
  };

  const cmd = new FinishRunCommand(api);
  await invoker.run(cmd, input);
}

/**
 * Firekit compatibility stub for aborting a run.
 *
 * From @bdelab/roar-firekit:
 * ```ts
 * abortRun() { […] }
 * ```
 *
 * Preserves the legacy Firekit synchronous signature while issuing a best-effort
 * asynchronous abort request to the backend when a run is active.
 *
 * @returns void
 */
export function abortRun(): void {
  const facade = getFirekitCompat();
  const runId = facade._getRunId();

  // No active run: preserve Firekit-like no-op behavior
  if (!runId) return;

  void (async () => {
    const api = facade.getApi();
    const invoker = facade.getInvoker();

    const cmd = new AbortRunCommand(api);
    await invoker.run(cmd, { runId, type: RUN_EVENT_ABORT });
  })().catch((err) => {
    facade.getContext().logger?.warn?.('[firekit.abortRun] Failed to abort run on backend:', err);
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
 * Firekit compatibility method for writing trial data.
 *
 * From @bdelab/roar-firekit:
 * async writeTrial(trialData: TrialData, computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>) { […] }
 *
 * Records a trial event for the active run.
 *
 * Firekit-compatible wrapper that submits trial data to the assessment backend.
 * The trial data is transformed and sent as a WriteTrial command event.
 *
 * @param trialData - Trial data object containing assessment-specific trial information
 * @param computedScoreCallback - Optional callback function that receives raw scores and returns computed scores (not yet implemented)
 * @returns Promise<void> - Resolves when the trial event has been successfully submitted
 * @throws {SDKError} If no active run exists. Call appkit.startRun() first.
 *
 * @example
 * ```typescript
 * const trialData = {
 *   assessmentStage: 'test',
 *   correct: 1,
 *   response: 'A',
 *   rt: 1500
 * };
 * await writeTrial(trialData);
 * ```
 */
export async function writeTrial(
  trialData: TrialData,
  computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>,
): WriteTrialOutput {
  void computedScoreCallback;

  const facade = getFirekitCompat();
  const runId = facade._getRunId();

  if (!runId) {
    throw new SDKError('appkit.writeTrial requires an active run. Call appkit.startRun() first.');
  }

  const api = facade.getApi();
  const invoker = facade.getInvoker();

  const cmd = new WriteTrialCommand(api);

  await invoker.run(cmd, {
    runId,
    type: RUN_EVENT_TRIAL,
    trial: trialData as {
      assessmentStage: 'practice' | 'test' | 'practice_response' | 'test_response';
      correct: number;
      payload?: Json;
      [key: string]: unknown;
    },
  });
}
