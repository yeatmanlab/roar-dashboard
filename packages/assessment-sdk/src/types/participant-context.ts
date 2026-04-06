/**
 * ParticipantContext provides identity information for SDK operations.
 *
 * This object is passed from the game to the SDK and contains the participant's
 * identity along with optional contextual information about the assessment.
 *
 * The flow is: Dashboard → Game → SDK
 * - Dashboard passes participant identity to the game
 * - Game passes ParticipantContext to the SDK
 * - SDK uses participantId to build endpoint paths and validate operations
 *
 * @property participantId - Required unique identifier for the participant. Used to build
 *                          endpoint paths and validate that operations are performed for
 *                          the correct participant.
 * @property administrationId - Optional administration ID for the assessment
 * @property taskVariantId - Optional task variant ID
 * @property taskVersion - Optional task version
 *
 * @example
 * ```ts
 * const participantContext: ParticipantContext = {
 *   participantId: 'participant-123',
 *   administrationId: 'admin-456',
 *   taskVariantId: 'variant-789',
 *   taskVersion: '1.0.0'
 * };
 * ```
 */
export interface ParticipantContext {
  participantId: string;
  administrationId?: string;
  taskVariantId?: string;
  taskVersion?: string;
}
