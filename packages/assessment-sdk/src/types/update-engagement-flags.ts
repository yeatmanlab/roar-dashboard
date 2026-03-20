import { RUN_EVENT_ENGAGEMENT } from './run-event-status';

/**
 * Input for the UpdateRunEngagementFlagsCommand.
 *
 * Represents a request to update engagement flags for a run, indicating
 * whether the run should be flagged for quality issues. All engagement flag
 * properties are optional and default to false/undefined if not provided.
 *
 * @property runId - The unique identifier of the run to update
 * @property type - The event type, must be 'engagement' (RUN_EVENT_ENGAGEMENT constant)
 * @property engagementFlags - Optional object containing flags indicating quality issues.
 *   Only flags set to true will be sent to the backend:
 *   - incomplete: Run was not completed by the user
 *   - responseTimeTooFast: Responses were answered too quickly, suggesting lack of engagement
 *   - accuracyTooLow: Accuracy was below acceptable threshold for the assessment
 *   - notEnoughResponses: Insufficient number of responses were recorded
 * @property reliableRun - Optional flag indicating if the run should be marked as reliable.
 *   When true, indicates the run passed quality checks. Defaults to false if not provided.
 *
 * @example
 * ```typescript
 * const input: UpdateRunEngagementFlagsCommandInput = {
 *   runId: 'run-456',
 *   type: RUN_EVENT_ENGAGEMENT,
 *   engagementFlags: {
 *     incomplete: true,
 *     responseTimeTooFast: false,
 *   },
 *   reliableRun: false,
 * };
 * ```
 */
export interface UpdateRunEngagementFlagsCommandInput {
  runId: string;
  type: typeof RUN_EVENT_ENGAGEMENT;
  engagementFlags: {
    incomplete?: boolean;
    responseTimeTooFast?: boolean;
    accuracyTooLow?: boolean;
    notEnoughResponses?: boolean;
  };
  reliableRun?: boolean;
}

/**
 * Output from the UpdateRunEngagementFlagsCommand.
 * Returns an empty object on successful execution.
 */
export type UpdateRunEngagementFlagsCommandOutput = Record<string, never>;
