import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { UpdateRunEngagementFlagsCommand } from './update-engagement-flags.command';
import { StatusCodes } from 'http-status-codes';
import { createMockRoarApi } from '../test-support';
import type { UpdateRunEngagementFlagsCommandInput } from '../types/update-engagement-flags';
import { RUN_EVENT_ENGAGEMENT } from '../types/run-event-status';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums';

/**
 * Test suite for UpdateRunEngagementFlagsCommand.
 *
 * Tests the command's ability to:
 * - Submit engagement flags to the backend
 * - Handle optional reliability status
 * - Properly handle success and error responses
 * - Default reliableRun to false
 */
describe('UpdateRunEngagementFlagsCommand', () => {
  let command: UpdateRunEngagementFlagsCommand;
  let mockApi: ReturnType<typeof createMockRoarApi>;
  let eventMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockRoarApi();
    eventMock = mockApi.client.runs.event as Mock;
    command = new UpdateRunEngagementFlagsCommand(mockApi, 'participant-123');
  });

  it('has correct properties', () => {
    expect(command.name).toBe('UpdateRunEngagementFlags');
    expect(command.idempotent).toBe(false);
  });

  it('calls api.client.runs.event with correct parameters and returns empty object on success', async () => {
    const input: UpdateRunEngagementFlagsCommandInput = {
      runId: 'run-123',
      type: RUN_EVENT_ENGAGEMENT,
      engagementFlags: {
        incomplete: true,
        responseTimeTooFast: true,
      },
      reliableRun: true,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    const result = await command.execute(input);

    expect(eventMock).toHaveBeenCalledTimes(1);
    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-123', userId: 'participant-123' },
      body: {
        type: RUN_EVENT_ENGAGEMENT,
        engagementFlags: {
          incomplete: true,
          responseTimeTooFast: true,
        },
        reliableRun: true,
      },
    });
    expect(result).toEqual({});
  });

  it('defaults reliableRun to false when not provided', async () => {
    const input: UpdateRunEngagementFlagsCommandInput = {
      runId: 'run-456',
      type: RUN_EVENT_ENGAGEMENT,
      engagementFlags: {
        accuracyTooLow: true,
      },
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    const result = await command.execute(input);

    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-456', userId: 'participant-123' },
      body: {
        type: RUN_EVENT_ENGAGEMENT,
        engagementFlags: {
          accuracyTooLow: true,
        },
        reliableRun: false,
      },
    });
    expect(result).toEqual({});
  });

  it('handles multiple engagement flags', async () => {
    const input: UpdateRunEngagementFlagsCommandInput = {
      runId: 'run-789',
      type: RUN_EVENT_ENGAGEMENT,
      engagementFlags: {
        incomplete: true,
        responseTimeTooFast: true,
        accuracyTooLow: true,
        notEnoughResponses: true,
      },
      reliableRun: false,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.OK,
      body: {},
    });

    const result = await command.execute(input);

    expect(eventMock).toHaveBeenCalledWith({
      params: { runId: 'run-789', userId: 'participant-123' },
      body: {
        type: RUN_EVENT_ENGAGEMENT,
        engagementFlags: {
          incomplete: true,
          responseTimeTooFast: true,
          accuracyTooLow: true,
          notEnoughResponses: true,
        },
        reliableRun: false,
      },
    });
    expect(result).toEqual({});
  });

  it('throws SDKError with error message from response body', async () => {
    const input: UpdateRunEngagementFlagsCommandInput = {
      runId: 'run-123',
      type: RUN_EVENT_ENGAGEMENT,
      engagementFlags: {
        incomplete: true,
      },
      reliableRun: true,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.BAD_REQUEST,
      body: { error: { message: 'Invalid engagement flags' } },
    });

    await expect(command.execute(input)).rejects.toThrow(SDKError);
    await expect(command.execute(input)).rejects.toMatchObject({
      message: 'Invalid engagement flags',
      code: SdkErrorCode.UPDATE_RUN_ENGAGEMENT_FLAGS_FAILED,
    });
  });

  it('throws SDKError with status code message when error details are missing', async () => {
    const input: UpdateRunEngagementFlagsCommandInput = {
      runId: 'run-123',
      type: RUN_EVENT_ENGAGEMENT,
      engagementFlags: {
        incomplete: true,
      },
      reliableRun: true,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      body: {},
    });

    await expect(command.execute(input)).rejects.toThrow(SDKError);
    await expect(command.execute(input)).rejects.toMatchObject({
      message: 'Failed to update run engagement flags with status 500',
      code: SdkErrorCode.UPDATE_RUN_ENGAGEMENT_FLAGS_FAILED,
    });
  });

  it('throws SDKError with status code message when body is null', async () => {
    const input: UpdateRunEngagementFlagsCommandInput = {
      runId: 'run-123',
      type: RUN_EVENT_ENGAGEMENT,
      engagementFlags: {
        incomplete: true,
      },
      reliableRun: true,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.NOT_FOUND,
      body: null,
    });

    await expect(command.execute(input)).rejects.toThrow(SDKError);
    await expect(command.execute(input)).rejects.toMatchObject({
      message: 'Failed to update run engagement flags with status 404',
      code: SdkErrorCode.UPDATE_RUN_ENGAGEMENT_FLAGS_FAILED,
    });
  });

  it('propagates errors from api.client.runs.event', async () => {
    const input: UpdateRunEngagementFlagsCommandInput = {
      runId: 'run-123',
      type: RUN_EVENT_ENGAGEMENT,
      engagementFlags: {
        incomplete: true,
      },
      reliableRun: true,
    };

    eventMock.mockRejectedValue(new Error('Network error'));

    await expect(command.execute(input)).rejects.toThrow('Network error');
  });

  it('throws SDKError when run is in terminal state (409 Conflict)', async () => {
    const input: UpdateRunEngagementFlagsCommandInput = {
      runId: 'run-123',
      type: RUN_EVENT_ENGAGEMENT,
      engagementFlags: {
        incomplete: true,
      },
      reliableRun: true,
    };

    eventMock.mockResolvedValue({
      status: StatusCodes.CONFLICT,
      body: {},
    });

    await expect(command.execute(input)).rejects.toThrow(SDKError);
    await expect(command.execute(input)).rejects.toMatchObject({
      message: 'Failed to update run engagement flags with status 409',
      code: SdkErrorCode.UPDATE_RUN_ENGAGEMENT_FLAGS_FAILED,
    });
  });
});
