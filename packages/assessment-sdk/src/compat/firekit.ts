import type { CommandContext } from '../command/command';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums/sdk-error-code.enum';
import {
  ASSESSMENT_STAGE_PRACTICE,
  ASSESSMENT_STAGE_PRACTICE_RESPONSE,
  ASSESSMENT_STAGE_TEST,
  ASSESSMENT_STAGE_TEST_RESPONSE,
} from '../enums';
import type {
  StartRunInput,
  FinishRunInput,
  AddInteractionInput,
  AddInteractionOutput,
  UpdateUserInput,
  UpdateUserOutput,
  TrialData,
  RawScores,
  ComputedScores,
  WriteTrialOutput,
} from '../types';
import { RUN_EVENT_ABORT, RUN_EVENT_COMPLETE, RUN_EVENT_TRIAL, RUN_EVENT_ENGAGEMENT } from '../types/run-event-status';
import type { Json } from '@roar-dashboard/api-contract';
import { Invoker } from '../command/invoker';
import { RoarApi } from '../receiver/roar-api';
import { StartRunCommand } from '../commands/start-run.command';
import { AbortRunCommand } from '../commands/abort-run.command';
import { FinishRunCommand } from '../commands/finish-run.command';
import { WriteTrialCommand } from '../commands/write-trial.command';
import { UpdateRunEngagementFlagsCommand } from '../commands/update-engagement-flags.command';

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
  /** Buffer for interaction events, flushed when writeTrial() is called */
  private interactionBuffer: AddInteractionInput[] = [];

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
    this.interactionBuffer = [];
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
  _setRunId(runId: string | undefined): void {
    this.runId = runId;
  }

  /**
   * Internal getter for task info.
   * @internal
   */
  _getTaskInfo(): CompatTaskInfo | undefined {
    return this.taskInfo;
  }

  /**
   * Atomically retrieves and clears the interaction buffer.
   * This prevents race conditions when writeTrial() is called concurrently.
   * @internal
   * @returns Array of buffered interaction events
   */
  _drainInteractionBuffer(): AddInteractionInput[] {
    const buffer = this.interactionBuffer;
    this.interactionBuffer = [];
    return buffer;
  }

  /**
   * Adds an interaction event to the buffer.
   * Interactions are accumulated and flushed when writeTrial() is called.
   * @internal
   * @param interaction - The interaction event to buffer
   */
  _pushInteraction(interaction: AddInteractionInput): void {
    this.interactionBuffer.push(interaction);
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
 * **Behavior:**
 * - Marks the run with a completion event in the backend
 * - Includes any provided metadata in the request
 * - Clears the internal runId after successful completion to prevent stale state
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
  facade._setRunId(undefined);
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
    facade._setRunId(undefined);
  })().catch((err) => {
    facade.getContext().logger?.warn?.('[firekit.abortRun] Failed to abort run on backend:', err);
  });
}

/**
 * Firekit compatibility method for updating engagement flags on a run.
 *
 * Marks a run with quality flags such as incomplete responses, response times that are too fast,
 * accuracy that is too low, or insufficient number of responses. Optionally marks the run as reliable.
 *
 * **Breaking Change**: The `reliableByBlock` parameter from the original Firekit API is no longer supported.
 * Use `markAsReliable` to mark the entire run as reliable instead.
 *
 * @param flagNames - Array of engagement flag names to set (e.g., 'incomplete', 'response_time_too_fast')
 * @param markAsReliable - Optional flag to mark the run as reliable (defaults to false)
 * @returns Promise that resolves when the engagement flags have been sent to the backend
 * @throws {SDKError} If no active run exists
 *
 * @example
 * ```typescript
 * await updateEngagementFlags(['incomplete', 'response_time_too_fast'], true);
 * ```
 */
export async function updateEngagementFlags(flagNames: string[], markAsReliable?: boolean): Promise<void> {
  const facade = getFirekitCompat();
  const runId = facade._getRunId();

  if (!runId) {
    throw new SDKError('appkit.updateEngagementFlags requires an active run. Call appkit.startRun() first.');
  }

  const api = facade.getApi();
  const invoker = facade.getInvoker();

  // Map snake_case Firekit flag names to camelCase SDK property names
  const flagNameMap: Record<string, string> = {
    incomplete: 'incomplete',
    response_time_too_fast: 'responseTimeTooFast',
    accuracy_too_low: 'accuracyTooLow',
    not_enough_responses: 'notEnoughResponses',
  };

  const engagementFlags = Object.fromEntries(flagNames.map((flag) => [flagNameMap[flag] || flag, true])) as Record<
    string,
    boolean
  >;

  const cmd = new UpdateRunEngagementFlagsCommand(api);

  await invoker.run(cmd, {
    runId,
    type: RUN_EVENT_ENGAGEMENT,
    engagementFlags,
    reliableRun: markAsReliable ?? false,
  });
  facade._setRunId(undefined);
}

/**
 * Firekit compatibility method for buffering interaction events.
 *
 * From @bdelab/roar-firekit:
 * addInteraction(interaction: InteractionEvent) { […] }
 *
 * Interactions are buffered in memory and later flushed with `writeTrial()`.
 *
 * @param interaction - The interaction event to record
 * @returns void
 */
export function addInteraction(interaction: AddInteractionInput): AddInteractionOutput {
  const facade = getFirekitCompat();
  if (!facade._getTaskInfo()) {
    throw new SDKError('appkit.addInteraction requires initialization. Call appkit.initFirekitCompat() first.');
  }
  if (!facade._getRunId()) {
    throw new SDKError('appkit.addInteraction requires an active run. Call appkit.startRun() first.');
  }
  facade._pushInteraction(interaction);
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
 * ```ts
 * async writeTrial(trialData: TrialData, computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>) { […] }
 * ```
 *
 * Records a trial event for the active run in the ROAR assessment backend.
 *
 * **Initialization requirement:**
 * - `initFirekitCompat()` must be called before invoking this function
 * - `startRun()` must be called to create an active run
 *
 * **Behavior:**
 * - Validates required fields (assessmentStage, correct) to prevent silent failures
 * - Coerces boolean correct values to numbers (true → 1, false → 0) for Firekit compatibility
 * - Normalizes assessment stages and interaction events to backend format
 * - Submits trial data via the WriteTrialCommand
 * - Supports optional computed score callback (not yet implemented)
 *
 * **Required trial data fields:**
 * - `assessmentStage`: ASSESSMENT_STAGE_PRACTICE, ASSESSMENT_STAGE_PRACTICE_RESPONSE, ASSESSMENT_STAGE_TEST, or ASSESSMENT_STAGE_TEST_RESPONSE
 * - `correct`: 1 (correct), 0 (incorrect), or boolean (true/false)
 *
 * **Optional trial data fields:**
 * - `response`: User's response
 * - `rt`: Reaction time in milliseconds
 * - `payload`: Custom JSON data
 * - Any other assessment-specific fields
 *
 * @param trialData - Trial data object containing assessment-specific trial information
 * @param computedScoreCallback - Optional callback function that receives raw scores and returns computed scores (not yet implemented)
 * @returns Promise<void> - Resolves when the trial event has been successfully submitted
 *
 * @throws {SDKError}
 * - If no active run exists (call appkit.startRun() first)
 * - If assessmentStage is missing or not a string
 * - If assessmentStage is not one of the valid values (ASSESSMENT_STAGE_PRACTICE, ASSESSMENT_STAGE_PRACTICE_RESPONSE, ASSESSMENT_STAGE_TEST, ASSESSMENT_STAGE_TEST_RESPONSE)
 * - If correct is missing or not a number/boolean
 * - If the backend request fails
 *
 * @example
 * ```typescript
 * // Basic trial submission
 * const trialData = {
 *   assessmentStage: 'test',
 *   correct: 1,
 *   response: 'A',
 *   rt: 1500
 * };
 * await writeTrial(trialData);
 *
 * // With boolean correct value (legacy Firekit)
 * await writeTrial({
 *   assessmentStage: 'test',
 *   correct: true,  // Coerced to 1
 *   response: 'B',
 *   rt: 1200
 * });
 *
 * // With custom payload
 * await writeTrial({
 *   assessmentStage: 'practice',
 *   correct: 0,
 *   response: 'C',
 *   rt: 2000,
 *   payload: { difficulty: 'hard', hint_used: true }
 * });
 * ```
 */
export async function writeTrial(
  trialData: TrialData,
  computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>,
): WriteTrialOutput {
  // TODO: Invoke callback with raw scores once score computation is implemented
  void computedScoreCallback;

  const facade = getFirekitCompat();
  const runId = facade._getRunId();

  if (!runId) {
    throw new SDKError('appkit.writeTrial requires an active run. Call appkit.startRun() first.', {
      code: SdkErrorCode.WRITE_TRIAL_FAILED,
    });
  }

  const api = facade.getApi();
  const invoker = facade.getInvoker();

  // Validate required fields to prevent silent failures
  const trialDataRecord = trialData as Record<string, unknown>;
  if (typeof trialDataRecord['assessmentStage'] !== 'string') {
    throw new SDKError('writeTrial requires assessmentStage in trial data.', {
      code: SdkErrorCode.WRITE_TRIAL_FAILED,
    });
  }

  const assessmentStage = trialDataRecord['assessmentStage'] as string;
  const validStages = [
    ASSESSMENT_STAGE_PRACTICE,
    ASSESSMENT_STAGE_PRACTICE_RESPONSE,
    ASSESSMENT_STAGE_TEST,
    ASSESSMENT_STAGE_TEST_RESPONSE,
  ] as const;
  if (!validStages.includes(assessmentStage as (typeof validStages)[number])) {
    throw new SDKError(
      `writeTrial requires assessmentStage to be one of: ${validStages.join(', ')}. Got: ${assessmentStage}`,
      {
        code: SdkErrorCode.WRITE_TRIAL_FAILED,
      },
    );
  }

  if (typeof trialDataRecord['correct'] !== 'number' && typeof trialDataRecord['correct'] !== 'boolean') {
    throw new SDKError('writeTrial requires correct in trial data.', {
      code: SdkErrorCode.WRITE_TRIAL_FAILED,
    });
  }

  // Coerce boolean correct values (legacy Firekit) to numbers
  const normalizedTrialData = {
    ...trialData,
    correct:
      typeof trialDataRecord['correct'] === 'boolean'
        ? trialDataRecord['correct']
          ? 1
          : 0
        : trialDataRecord['correct'],
  };

  const cmd = new WriteTrialCommand(api);

  // Capture interactions before the attempt, but only drain after success.
  // This ensures interactions are retried if the network call fails.
  // To prevent duplicate interactions in concurrent writeTrial calls, we use a temporary
  // buffer that's only committed after the invoker succeeds.
  const bufferedInteractions = facade._drainInteractionBuffer();
  try {
    await invoker.run(cmd, {
      runId,
      type: RUN_EVENT_TRIAL,
      trial: normalizedTrialData as {
        assessmentStage: 'practice' | 'test' | 'practice_response' | 'test_response';
        correct: number;
        payload?: Json;
        [key: string]: unknown;
      },
      ...(bufferedInteractions.length > 0
        ? {
            interactions: bufferedInteractions,
          }
        : {}),
    });
  } catch (error) {
    // Restore interactions to buffer if the write trial fails, so they can be retried
    for (const interaction of bufferedInteractions) {
      facade._pushInteraction(interaction);
    }
    throw error;
  }
}
