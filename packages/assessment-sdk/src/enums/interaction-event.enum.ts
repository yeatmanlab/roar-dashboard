/**
 * Interaction event constants for trial events.
 *
 * These constants define the valid interaction events that can be recorded during trial execution.
 * The SDK normalizes camelCase Firekit event names to snake_case for backend compatibility.
 */

export const INTERACTION_EVENT_BLUR = 'blur' as const;
export const INTERACTION_EVENT_FOCUS = 'focus' as const;
export const INTERACTION_EVENT_FULLSCREEN_ENTER = 'fullscreenenter' as const;
export const INTERACTION_EVENT_FULLSCREEN_EXIT = 'fullscreenexit' as const;

/**
 * Normalized interaction event constants (backend format).
 * These are the values that the backend expects in snake_case.
 */
export const NORMALIZED_INTERACTION_EVENT_BLUR = 'blur' as const;
export const NORMALIZED_INTERACTION_EVENT_FOCUS = 'focus' as const;
export const NORMALIZED_INTERACTION_EVENT_FULLSCREEN_ENTER = 'fullscreen_enter' as const;
export const NORMALIZED_INTERACTION_EVENT_FULLSCREEN_EXIT = 'fullscreen_exit' as const;
