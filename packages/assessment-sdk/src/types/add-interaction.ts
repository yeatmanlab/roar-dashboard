/**
 * Firekit-compatible input for appkit.addInteraction
 * Matches: addInteraction(interaction: InteractionEvent)
 * Note: trial field is not required here as it's added during writeTrial
 */
export type AddInteractionInput = {
  event: 'blur' | 'focus' | 'fullscreenenter' | 'fullscreenexit';
  time: number;
};

export type AddInteractionOutput = void;
