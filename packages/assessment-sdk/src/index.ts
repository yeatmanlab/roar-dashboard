import { Invoker } from './command/invoker';
import { RoarApi } from './receiver/roar-api';
import { SDKError } from './errors/sdk-error';
import type { CommandContext } from './command/command';

// Public API exports
export { Invoker } from './command/invoker';
export type { Command, CommandContext, Logger } from './command/command';
export { RoarApi } from './receiver/roar-api';
export { SDKError } from './errors/sdk-error';

// Global singleton instances for the SDK
let globalInvoker: Invoker | undefined;
let globalApi: RoarApi | undefined;

/**
 * Initializes the Assessment SDK with configuration.
 * Creates and stores singleton instances of Invoker and RoarApi.
 * 
 * Should be called once at application startup before using the SDK.
 * 
 * @param ctx - CommandContext with baseUrl, auth callbacks, and optional logger
 * @returns Object with initialized invoker and api instances
 * 
 * Example:
 * ```
 * const { invoker, api } = initAssessmentSdk({
 *   baseUrl: 'https://api.example.com',
 *   auth: {
 *     getToken: async () => localStorage.getItem('token'),
 *     refreshToken: async () => { ... }
 *   },
 *   requestId: () => crypto.randomUUID(),
 *   logger: console
 * });
 * ```
 */
export function initAssessmentSdk(ctx: CommandContext) {
  globalInvoker = new Invoker(ctx);
  globalApi = new RoarApi(ctx);
  return {
    invoker: globalInvoker,
    api: globalApi,
  };
}

/**
 * Retrieves the initialized Invoker instance.
 * Can be called from anywhere after initAssessmentSdk().
 * 
 * @returns Invoker singleton instance
 * @throws SDKError if SDK not initialized
 */
export function getInvoker() {
  if (!globalInvoker) {
    throw new SDKError('Assessment SDK not initialized. Call initAssessmentSdk() first.');
  }
  return globalInvoker;
}

/**
 * Retrieves the initialized RoarApi instance.
 * Can be called from anywhere after initAssessmentSdk().
 * 
 * @returns RoarApi singleton instance
 * @throws SDKError if SDK not initialized
 */
export function getApi() {
  if (!globalApi) {
    throw new SDKError('Assessment SDK not initialized. Call initAssessmentSdk() first.');
  }
  return globalApi;
}