import type { WriteTrialInteractionCommandInput } from './write-trial';

/**
 * Firekit-compatible input for appkit.addInteraction
 * Matches: addInteraction(interaction: InteractionEvent)
 */
export type AddInteractionInput = WriteTrialInteractionCommandInput;

export type AddInteractionOutput = void;
