import type { Command, CommandContext } from './command';
import { SDKError } from '../errors/sdk-error';

/**
 * Configuration options for Invoker retry behavior.
 * 
 * @property retries - Number of retry attempts (default: 3)
 * @property retryDelayMs - Delay between retries in milliseconds (default: 1000)
 */
export interface InvokerOptions {
  retries?: number;
  retryDelayMs?: number;
}

/**
 * Invoker implements the GoF Invoker pattern with cross-cutting concerns.
 * 
 * Responsibilities:
 * - Execute commands with automatic retry logic for idempotent operations
 * - Log execution attempts, failures, and successes
 * - Manage retry delays between attempts
 * 
 * Key behavior:
 * - Only retries if command.idempotent === true
 * - Non-idempotent commands execute exactly once (no retries)
 * - Logs all attempts for observability
 */
export class Invoker {
  private retries: number;
  private retryDelayMs: number;

  constructor(private ctx: CommandContext, opts?: InvokerOptions) {
    this.retries = opts?.retries ?? 3;
    this.retryDelayMs = opts?.retryDelayMs ?? 1000;
  }

  /**
   * Executes a command with automatic retry logic.
   * 
   * @template TInput - Input type for the command
   * @template TOutput - Output type returned by the command
   * @param command - Command to execute
   * @param input - Input data for the command
   * @returns Promise resolving to command output on success
   * @throws SDKError if all attempts fail
   */
  async run<TInput, TOutput>(
    command: Command<TInput, TOutput>,
    input: TInput
  ): Promise<TOutput> {
    // Determine max attempts: idempotent commands get retries, non-idempotent get 1 attempt
    const maxAttempts = command.idempotent ? this.retries + 1 : 1;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        this.ctx.logger?.debug(`[${command.name}] Executing attempt ${attempt + 1}/${maxAttempts}`);
        const result = await command.execute(input);
        this.ctx.logger?.info(`[${command.name}] Execution succeeded`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.ctx.logger?.warn(`[${command.name}] Attempt ${attempt + 1} failed:`, lastError.message);

        // Wait before next attempt (except on last attempt)
        if (attempt < maxAttempts - 1) {
          await this.delay(this.retryDelayMs);
        }
      }
    }

    // All attempts exhausted
    this.ctx.logger?.error(`[${command.name}] Failed after ${maxAttempts} attempts`);
    throw new SDKError(`Command '${command.name}' execution failed after ${maxAttempts} attempts`, {
      cause: lastError,
    });
  }

  /**
   * Utility to delay execution between retry attempts.
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
