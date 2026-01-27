/**
 * Firekit-compatible input for appkit.addInteraction
 * Matches: addInteraction(interaction: InteractionEvent)
 */
export type AddInteractionInput = InteractionEvent;

export type AddInteractionOutput = void;

/**
 * InteractionEvent type from Firekit
 * Represents a user interaction during an assessment
 */
export interface InteractionEvent {
  [key: string]: unknown;
}
