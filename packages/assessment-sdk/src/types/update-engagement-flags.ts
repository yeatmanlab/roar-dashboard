/**
 * Literal type for engagement event type.
 * Used to discriminate engagement events in the run event union type.
 */
export const RUN_EVENT_ENGAGEMENT = 'engagement' as const;

/**
 * Input for the UpdateRunEngagementFlagsCommand.
 *
 * Represents a request to update engagement flags for a run, indicating
 * whether the run should be flagged for quality issues.
 *
 * @property runId - The unique identifier of the run to update
 * @property type - The event type, must be 'engagement'
 * @property engagementFlags - Optional flags indicating quality issues:
 *   - incomplete: Run was not completed
 *   - responseTimeTooFast: Responses were answered too quickly
 *   - accuracyTooLow: Accuracy was below acceptable threshold
 *   - notEnoughResponses: Insufficient number of responses
 * @property reliableRun - Optional flag indicating if the run should be marked as reliable (defaults to false)
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
