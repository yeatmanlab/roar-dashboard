import type { CommandContext } from '../command/command';
import { SDKError } from '../errors/sdk-error';
import type { AddInteractionInput, AddInteractionOutput } from '../types';

/**
 * FirekitFacade provides backward compatibility with legacy Firekit-based assessments.
 * 
 * This class maintains the same API surface as @bdelab/roar-firekit while delegating
 * to the new command-based architecture under the hood.
 */
export class FirekitFacade {
  private static instance: FirekitFacade;
  private context?: CommandContext;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): FirekitFacade {
    if (!FirekitFacade.instance) {
      FirekitFacade.instance = new FirekitFacade();
    }
    return FirekitFacade.instance;
  }

  public setContext(context: CommandContext): void {
    this.context = context;
  }

  public getContext(): CommandContext | undefined {
    return this.context;
  }
}

/**
 * Initialize the Firekit compatibility layer.
 * 
 * @param context - Command context for the current assessment session
 * @returns FirekitFacade instance
 */
export function initFirekitCompat(context: CommandContext): FirekitFacade {
  const facade = FirekitFacade.getInstance();
  facade.setContext(context);
  return facade;
}

/**
 * Get the Firekit compatibility facade instance.
 * 
 * @returns FirekitFacade instance
 */
export function getFirekitCompat(): FirekitFacade {
  return FirekitFacade.getInstance();
}

/**
 * Firekit compatibility stub.
 *
 * From @bdelab/roar-firekit:
 * addInteraction(interaction: InteractionEvent) { […] }
 *
 * @param interaction - The interaction event to record.
 * @returns void
 * @throws SDKError - Always, until implemented.
 */
export function addInteraction(interaction: AddInteractionInput): AddInteractionOutput {
  void interaction;
  throw new SDKError('appkit.addInteraction not yet implemented');
}
