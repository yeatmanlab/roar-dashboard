/**
 * ParticipantContext provides identity information for SDK operations.
 *
 * This object is passed from the game to the SDK and contains the participant's
 * unique identifier.
 *
 * The flow is: Dashboard → Game → SDK
 * - Dashboard passes participant identity to the game
 * - Game passes ParticipantContext to the SDK
 * - SDK uses participantId to validate operations and scope API requests
 *
 * @property participantId - Required unique identifier for the participant. Used to validate
 *                          that operations are performed for the correct participant.
 *
 * @example
 * ```ts
 * const participantContext: ParticipantContext = {
 *   participantId: 'participant-123'
 * };
 * ```
 */
export interface ParticipantContext {
  participantId: string;
}
