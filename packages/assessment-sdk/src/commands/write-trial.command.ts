import { StatusCodes } from 'http-status-codes';
import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type {
  WriteTrialAssessmentStage,
  WriteTrialCommandInput,
  WriteTrialCommandOutput,
  WriteTrialInteractionEvent,
} from '../types/write-trial';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums';

/**
 * Normalizes assessment stage values to backend-compatible format.
 *
 * Maps Firekit-compatible stage values to the backend's simplified format:
 * - 'practice' and 'practice_response' → 'practice'
 * - 'test' and 'test_response' → 'test'
 *
 * @param stage - The assessment stage from Firekit
 * @returns Normalized stage value ('practice' or 'test')
 */
function normalizeAssessmentStage(stage: WriteTrialAssessmentStage): 'practice' | 'test' {
  if (stage === 'practice' || stage === 'practice_response') {
    return 'practice';
  }

  return 'test';
}

/**
 * Normalizes interaction event names to backend-compatible format.
 *
 * Maps Firekit-compatible event names to the backend's snake_case format:
 * - 'fullscreenenter' → 'fullscreen_enter'
 * - 'fullscreenexit' → 'fullscreen_exit'
 * - Other events ('blur', 'focus') pass through unchanged
 *
 * @param event - The interaction event from Firekit
 * @returns Normalized event name
 */
function normalizeInteractionEvent(
  event: WriteTrialInteractionEvent,
): 'blur' | 'focus' | 'fullscreen_enter' | 'fullscreen_exit' {
  if (event === 'fullscreenenter') return 'fullscreen_enter';
  if (event === 'fullscreenexit') return 'fullscreen_exit';
  return event;
}

/**
 * Command to record a trial event for an assessment run in the ROAR backend.
 *
 * This command submits trial data (responses, reaction times, etc.) to the backend
 * for a specific run, optionally including interaction events (focus, blur, fullscreen).
 *
 * This command is non-idempotent; the Invoker will execute it exactly once.
 *
 * **Behavior:**
 * - Sends a POST request to `/runs/:runId/event` with type `trial`
 * - Normalizes assessment stages and interaction events to backend format
 * - Transforms interaction `time` field to `timeMs` for the backend
 * - Returns an empty object on success (HTTP 200)
 * - Throws `SDKError` with code `WRITE_TRIAL_FAILED` on failure
 *
 * **Error handling:**
 * - Extracts error message from backend response if available
 * - Falls back to generic error message with HTTP status code
 *
 * @implements {Command<WriteTrialCommandInput, WriteTrialCommandOutput>}
 *
 * @example
 * ```ts
 * const api = new RoarApi(context);
 * const cmd = new WriteTrialCommand(api);
 * const invoker = new Invoker(context);
 *
 * await invoker.run(cmd, {
 *   runId: 'run-123',
 *   type: 'trial',
 *   trial: {
 *     assessmentStage: 'test',
 *     correct: 1,
 *     response: 'A',
 *     rt: 1500
 *   },
 *   interactions: [
 *     { event: 'focus', trial: 1, time: 100 },
 *     { event: 'blur', trial: 1, time: 200 }
 *   ]
 * });
 * ```
 */
export class WriteTrialCommand implements Command<WriteTrialCommandInput, WriteTrialCommandOutput> {
  readonly name = 'WriteTrial';
  readonly idempotent = false;

  constructor(private api: RoarApi) {}

  /**
   * Executes the write trial command.
   *
   * @param input - The write trial input containing runId, trial data, and optional interactions
   * @returns Promise<WriteTrialCommandOutput> - Empty object on success
   * @throws {SDKError} If the backend request fails, with code `WRITE_TRIAL_FAILED`
   */
  async execute(input: WriteTrialCommandInput): Promise<WriteTrialCommandOutput> {
    const { assessmentStage, ...restTrial } = input.trial;

    const result = await this.api.client.runs.event({
      params: { runId: input.runId },
      body: {
        type: input.type,
        trial: {
          ...restTrial,
          assessmentStage: normalizeAssessmentStage(assessmentStage),
        },
        ...(input.interactions
          ? {
              interactions: input.interactions.map((interaction) => ({
                event: normalizeInteractionEvent(interaction.event),
                timeMs: interaction.time,
                // interaction.trial is not forwarded to backend as it's redundant with the trial context
              })),
            }
          : {}),
      },
    });

    if (result.status === StatusCodes.OK) {
      return {};
    }

    const errorBody = result.body as { error?: { message?: string } };

    throw new SDKError(errorBody?.error?.message ?? `Failed to write trial with status ${result.status}`, {
      code: SdkErrorCode.WRITE_TRIAL_FAILED,
    });
  }
}
