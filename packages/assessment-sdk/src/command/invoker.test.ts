import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Invoker } from './invoker';
import type { Command, CommandContext } from './command';
import { SDKError } from '../errors/sdk-error';

/**
 * Unit tests for the Invoker class.
 * Tests cover retry logic, idempotency, logging, and error handling.
 */
describe('Invoker', () => {
  let invoker: Invoker;
  let mockCommand: Command<string, string>;
  let context: CommandContext;

  beforeEach(() => {
    context = {
      baseUrl: 'http://localhost:3000',
      auth: {
        getToken: vi.fn().mockResolvedValue('token'),
      },
    };
    invoker = new Invoker(context, { retries: 2, retryDelayMs: 10 });
    mockCommand = {
      name: 'TestCommand',
      idempotent: true,
      execute: vi.fn().mockResolvedValue('success'),
    };
  });

  it('should execute an idempotent command successfully', async () => {
    const result = await invoker.run(mockCommand, 'input');
    expect(result).toBe('success');
    expect(mockCommand.execute).toHaveBeenCalledWith('input');
  });

  it('should retry idempotent commands on failure', async () => {
    // Simulate 2 failures followed by success
    mockCommand.execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('Attempt 1'))
      .mockRejectedValueOnce(new Error('Attempt 2'))
      .mockResolvedValueOnce('success');

    const result = await invoker.run(mockCommand, 'input');
    expect(result).toBe('success');
    expect(mockCommand.execute).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-idempotent commands', async () => {
    const nonIdempotentCommand: Command<string, string> = {
      name: 'NonIdempotentCommand',
      idempotent: false,
      execute: vi.fn().mockRejectedValue(new Error('Failed')),
    };

    await expect(invoker.run(nonIdempotentCommand, 'input')).rejects.toThrow(SDKError);
    // Non-idempotent commands should execute exactly once
    expect(nonIdempotentCommand.execute).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries exceeded', async () => {
    mockCommand.execute = vi.fn().mockRejectedValue(new Error('Always fails'));

    await expect(invoker.run(mockCommand, 'input')).rejects.toThrow(SDKError);
    // With retries: 2, max attempts = 3 (initial + 2 retries)
    expect(mockCommand.execute).toHaveBeenCalledTimes(3);
  });

  it('should log execution attempts', async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    context.logger = logger;
    invoker = new Invoker(context, { retries: 1, retryDelayMs: 10 });

    await invoker.run(mockCommand, 'input');

    // Verify logging was called for observability
    expect(logger.debug).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });
});
