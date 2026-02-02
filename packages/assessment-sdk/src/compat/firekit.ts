import type { CommandContext } from '../command/command';
import { SDKError } from '../errors/sdk-error';
<<<<<<< HEAD
import type {
  StartRunInput,
  StartRunOutput,
  FinishRunInput,
  FinishRunOutput,
  AbortRunOutput,
  UpdateEngagementFlagsInput,
  UpdateEngagementFlagsOutput,
} from '../types';
=======
import type { StartRunInput, StartRunOutput, UpdateEngagementFlagsInput, UpdateEngagementFlagsOutput } from '../types';
>>>>>>> c6cdfc6c (update for code review suggestions)

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
 * Firekit compatibility stub.
 *
 * From @bdelab/roar-firekit:
 * async startRun(additionalRunMetadata?: { [key: string]: string })
 *
 * @param additionalRunMetadata Optional additional run metadata
 * @returns Promise<void>
 */
export async function startRun(additionalRunMetadata?: StartRunInput): Promise<StartRunOutput> {
  void additionalRunMetadata;
  throw new SDKError('appkit.startRun not yet implemented');
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
 * Firekit compatibility stub.
 *
 * From @bdelab/roar-firekit:
 * abortRun() { […] }
 *
 * @returns void
 * @throws SDKError - Always, until implemented.
 */
export function abortRun(): AbortRunOutput {
  throw new SDKError('firekit.abortRun not yet implemented');
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
