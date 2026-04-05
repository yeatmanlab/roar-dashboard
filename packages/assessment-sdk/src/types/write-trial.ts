import type { Json } from '@roar-dashboard/api-contract';
import { RUN_EVENT_TRIAL } from './run-event-status';

/**
 * Types for the WriteTrial command and Firekit compatibility layer.
 *
 * This module provides types for submitting trial events to the ROAR assessment backend.
 * It bridges Firekit-compatible trial data with the internal command structure.
 *
 * **Firekit Compatibility:**
 * The `writeTrial` function in the compat layer accepts Firekit-compatible trial data
 * and an optional callback for computed scores, matching the original Firekit signature:
 * ```ts
 * writeTrial(trialData: TrialData, computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>)
 * ```
 *
 * **Internal Command Structure:**
 * Internally, trial data is transformed into `WriteTrialCommandInput` for the backend API.
 * Assessment stages and interaction events are normalized to backend-compatible formats.
 */

/**
 * Trial data structure from Firekit.
 *
 * Flexible object that can contain any trial-related data.
 * Used as the base for trial input in the Firekit compatibility layer.
 */
export interface TrialData {
  [key: string]: unknown;
}

/**
 * Raw scores passed to the computed score callback.
 *
 * Contains unprocessed score data that can be transformed by the callback function.
 * Not yet implemented in the SDK.
 */
export interface RawScores {
  [key: string]: unknown;
}

/**
 * Computed scores returned from the callback function.
 *
 * Contains processed score data after transformation by the callback.
 * Not yet implemented in the SDK.
 */
export interface ComputedScores {
  [key: string]: unknown;
}

/**
 * Assessment stage for a trial.
 *
 * - `practice`: Practice stage
 * - `practice_response`: Practice response stage (normalized to 'practice')
 * - `test`: Test stage
 * - `test_response`: Test response stage (normalized to 'test')
 */
export type WriteTrialAssessmentStage = 'practice' | 'test' | 'practice_response' | 'test_response';

/**
 * User interaction event types during trial.
 *
 * - `blur`: User left the assessment window
 * - `focus`: User returned to the assessment window
 * - `fullscreenenter`: User entered fullscreen mode
 * - `fullscreenexit`: User exited fullscreen mode
 */
export type WriteTrialInteractionEvent = 'blur' | 'focus' | 'fullscreenenter' | 'fullscreenexit';

/**
 * Interaction event input for a trial.
 *
 * Records user interactions (focus, blur, fullscreen changes) that occur during trial execution.
 */
export interface WriteTrialInteractionCommandInput {
  /** The type of interaction event */
  event: WriteTrialInteractionEvent;
  /** Trial number this interaction occurred in (optional - not forwarded to backend, only used for internal tracking) */
  trial?: number;
  /** Timestamp in milliseconds when the interaction occurred */
  time: number;
}

/**
 * Trial data input for the WriteTrial command.
 *
 * Extends the base TrialData with required assessment metadata.
 * Can include additional custom fields via the TrialData extension.
 */
export interface WriteTrialTrialCommandInput extends TrialData {
  /** The assessment stage when this trial occurred */
  assessmentStage: WriteTrialAssessmentStage;
  /** Whether the response was correct (1 = correct, 0 = incorrect) */
  correct: number;
  /** Optional custom payload data for the trial */
  payload?: Json;
}

/**
 * Input for the WriteTrial command.
 *
 * Contains all data needed to record a trial event for an assessment run.
 */
export interface WriteTrialCommandInput {
  /** The ID of the run this trial belongs to */
  runId: string;
  /** Event type constant ('trial') */
  type: typeof RUN_EVENT_TRIAL;
  /** Trial data including stage, correctness, and response information */
  trial: WriteTrialTrialCommandInput;
  /** Optional array of interaction events that occurred during the trial */
  interactions?: WriteTrialInteractionCommandInput[];
}

/**
 * Output from the WriteTrial command.
 *
 * Internal command output type (empty object).
 */
export type WriteTrialCommandOutput = Record<string, never>;

/**
 * Output type for the Firekit-compatible writeTrial function.
 *
 * Resolves to void when the trial has been successfully submitted.
 */
export type WriteTrialOutput = Promise<void>;
