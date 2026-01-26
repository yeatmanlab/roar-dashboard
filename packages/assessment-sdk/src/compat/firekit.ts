import type { CommandContext } from '../command/command';
import { SDKError } from '../errors/sdk-error';
import type { StartRunOutput } from '../types';

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
export async function startRun(additionalRunMetadata?: { [key: string]: string }): Promise<StartRunOutput> {
  void additionalRunMetadata;
  throw new SDKError('appkit.startRun not yet implemented');
}
