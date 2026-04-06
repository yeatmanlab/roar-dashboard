import { StatusCodes } from 'http-status-codes';
import type { Command, CommandContext } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type {
  WriteTrialAssessmentStage,
  WriteTrialCommandInput,
  WriteTrialCommandOutput,
  WriteTrialInteractionEvent,
} from '../types/write-trial';
import { SDKError } from '../errors/sdk-error';
import {
  SdkErrorCode,
  ASSESSMENT_STAGE_PRACTICE,
  ASSESSMENT_STAGE_PRACTICE_RESPONSE,
  ASSESSMENT_STAGE_TEST,
  ASSESSMENT_STAGE_TEST_RESPONSE,
  INTERACTION_EVENT_BLUR,
  INTERACTION_EVENT_FOCUS,
  INTERACTION_EVENT_FULLSCREEN_ENTER,
  INTERACTION_EVENT_FULLSCREEN_EXIT,
} from '../enums';

/**
 * Normalizes assessment stage values to backend-compatible format.
 *
 * Maps Firekit-compatible stage values to the backend's simplified format:
 * - ASSESSMENT_STAGE_PRACTICE and ASSESSMENT_STAGE_PRACTICE_RESPONSE → 'practice'
 * - ASSESSMENT_STAGE_TEST and ASSESSMENT_STAGE_TEST_RESPONSE → 'test'
 *
 * This normalization allows the SDK to accept both response and non-response stage
 * values from Firekit while maintaining compatibility with the backend's simpler
 * two-stage model.
 *
 * @param stage - The assessment stage from Firekit
 * @returns Normalized stage value ('practice' or 'test')
 * @throws {SDKError} If stage is not a valid assessment stage value
 *
 * @example
 * ```ts
 * normalizeAssessmentStage(ASSESSMENT_STAGE_PRACTICE_RESPONSE) // → 'practice'
 * normalizeAssessmentStage(ASSESSMENT_STAGE_TEST) // → 'test'
 * ```
 */
function normalizeAssessmentStage(stage: WriteTrialAssessmentStage): 'practice' | 'test' {
  switch (stage) {
    case ASSESSMENT_STAGE_PRACTICE:
    case ASSESSMENT_STAGE_PRACTICE_RESPONSE:
      return 'practice';
    case ASSESSMENT_STAGE_TEST:
    case ASSESSMENT_STAGE_TEST_RESPONSE:
      return 'test';
    default: {
      const exhaustiveCheck: never = stage;
      throw new SDKError(`Unknown assessment stage: ${exhaustiveCheck}`, {
        code: SdkErrorCode.WRITE_TRIAL_FAILED,
      });
    }
  }
}

/**
 * Normalizes interaction event names to backend-compatible format.
 *
 * Maps Firekit-compatible event names to the backend's snake_case format:
 * - INTERACTION_EVENT_FULLSCREEN_ENTER → 'fullscreen_enter'
 * - INTERACTION_EVENT_FULLSCREEN_EXIT → 'fullscreen_exit'
 * - Other events (INTERACTION_EVENT_BLUR, INTERACTION_EVENT_FOCUS) pass through unchanged
 *
 * This normalization bridges the camelCase naming convention used by Firekit
 * with the snake_case convention expected by the backend API.
 *
 * @param event - The interaction event from Firekit
 * @returns Normalized event name in snake_case format
 * @throws {SDKError} If event is not a valid interaction event value
 *
 * @example
 * ```ts
 * normalizeInteractionEvent(INTERACTION_EVENT_FULLSCREEN_ENTER) // → 'fullscreen_enter'
 * normalizeInteractionEvent(INTERACTION_EVENT_FOCUS) // → 'focus'
 * ```
 */
function normalizeInteractionEvent(
  event: WriteTrialInteractionEvent,
): 'blur' | 'focus' | 'fullscreen_enter' | 'fullscreen_exit' {
  switch (event) {
    case INTERACTION_EVENT_BLUR:
      return 'blur';
    case INTERACTION_EVENT_FOCUS:
      return 'focus';
    case INTERACTION_EVENT_FULLSCREEN_ENTER:
      return 'fullscreen_enter';
    case INTERACTION_EVENT_FULLSCREEN_EXIT:
      return 'fullscreen_exit';
    default: {
      const exhaustiveCheck: never = event;
      throw new SDKError(`Unknown interaction event: ${exhaustiveCheck}`, {
        code: SdkErrorCode.WRITE_TRIAL_FAILED,
      });
    }
  }
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
 * - Validates that participantId is present in the SDK context
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
 * const cmd = new WriteTrialCommand(api, context);
 * const invoker = new Invoker(context);
 *
 * await invoker.run(cmd, {
 *   runId: 'run-123',
 *   type: RUN_EVENT_TRIAL,
 *   trial: {
 *     assessmentStage: ASSESSMENT_STAGE_TEST,
 *     correct: 1,
 *     response: 'A',
 *     rt: 1500
 *   },
 *   interactions: [
 *     { event: INTERACTION_EVENT_FOCUS, trial: 1, time: 100 },
 *     { event: INTERACTION_EVENT_BLUR, trial: 1, time: 200 }
 *   ]
 * });
 * ```
 */
export class WriteTrialCommand implements Command<WriteTrialCommandInput, WriteTrialCommandOutput> {
  readonly name = 'WriteTrial';
  readonly idempotent = false;

  constructor(
    private api: RoarApi,
    private ctx: CommandContext,
  ) {}

  /**
   * Executes the write trial command.
   *
   * @param input - The write trial input containing runId, trial data, and optional interactions
   * @param input.runId - The ID of the assessment run
   * @param input.type - The event type (should be RUN_EVENT_TRIAL)
   * @param input.trial - Trial data including assessment stage, response, correctness, and reaction time
   * @param input.trial.assessmentStage - The assessment stage (practice, practice_response, test, or test_response)
   * @param input.trial.correct - Whether the response was correct (0 or 1)
   * @param input.trial.response - The participant's response
   * @param input.trial.rt - The reaction time in milliseconds
   * @param input.interactions - Optional array of interaction events (focus, blur, fullscreen changes)
   * @param input.interactions[].event - The interaction event type
   * @param input.interactions[].trial - The trial number when the interaction occurred
   * @param input.interactions[].time - The time in milliseconds when the interaction occurred
   * @returns Promise<WriteTrialCommandOutput> - Empty object on success
   * @throws {SDKError} If participantId is missing, with code `WRITE_TRIAL_FAILED`
   * @throws {SDKError} If the backend request fails, with code `WRITE_TRIAL_FAILED`
   */
  async execute(input: WriteTrialCommandInput): Promise<WriteTrialCommandOutput> {
    if (!this.ctx.participant?.participantId) {
      throw new SDKError('participantId is required to write a trial', {
        code: SdkErrorCode.WRITE_TRIAL_FAILED,
      });
    }

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
