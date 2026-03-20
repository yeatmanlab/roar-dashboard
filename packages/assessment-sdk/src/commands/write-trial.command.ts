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
 * This normalization allows the SDK to accept both response and non-response stage
 * values from Firekit while maintaining compatibility with the backend's simpler
 * two-stage model.
 *
 * @param stage - The assessment stage from Firekit
 * @returns Normalized stage value ('practice' or 'test')
 *
 * @example
 * ```ts
 * normalizeAssessmentStage('practice_response') // → 'practice'
 * normalizeAssessmentStage('test') // → 'test'
 * ```
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
 * This normalization bridges the camelCase naming convention used by Firekit
 * with the snake_case convention expected by the backend API.
 *
 * @param event - The interaction event from Firekit
 * @returns Normalized event name in snake_case format
 *
 * @example
 * ```ts
 * normalizeInteractionEvent('fullscreenenter') // → 'fullscreen_enter'
 * normalizeInteractionEvent('focus') // → 'focus'
 * ```
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
 * **Idempotency:**
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
 * - HTTP 200 OK → Success
 * - HTTP 400 Bad Request → Extracts error message from response body (type-narrowed by status check)
 * - Other status codes → Generic error message with HTTP status code
 *
 * The API contract's `strictStatusCodes: true` configuration enables TypeScript to
 * automatically narrow the response body type based on the status code, eliminating
 * the need for explicit type casts.
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

    if (result.status === StatusCodes.BAD_REQUEST) {
      throw new SDKError(result.body.error?.message ?? `Failed to write trial with status ${result.status}`, {
        code: SdkErrorCode.WRITE_TRIAL_FAILED,
      });
    }

    throw new SDKError(`Failed to write trial with status ${result.status}`, {
      code: SdkErrorCode.WRITE_TRIAL_FAILED,
    });
  }
}
