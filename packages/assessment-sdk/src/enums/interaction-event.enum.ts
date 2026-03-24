/**
 * Interaction event constants for trial events.
 *
 * These constants define the valid interaction events that can be recorded during trial execution.
 * The SDK normalizes camelCase Firekit event names to snake_case for backend compatibility.
 *
 * Input events (from Firekit):
 * - INTERACTION_EVENT_BLUR: 'blur'
 * - INTERACTION_EVENT_FOCUS: 'focus'
 * - INTERACTION_EVENT_FULLSCREEN_ENTER: 'fullscreenenter'
 * - INTERACTION_EVENT_FULLSCREEN_EXIT: 'fullscreenexit'
 *
 * Normalized output events (to backend):
 * - 'blur' (from INTERACTION_EVENT_BLUR)
 * - 'focus' (from INTERACTION_EVENT_FOCUS)
 * - 'fullscreen_enter' (from INTERACTION_EVENT_FULLSCREEN_ENTER)
 * - 'fullscreen_exit' (from INTERACTION_EVENT_FULLSCREEN_EXIT)
 */

export const INTERACTION_EVENT_BLUR = 'blur' as const;
export const INTERACTION_EVENT_FOCUS = 'focus' as const;
export const INTERACTION_EVENT_FULLSCREEN_ENTER = 'fullscreenenter' as const;
export const INTERACTION_EVENT_FULLSCREEN_EXIT = 'fullscreenexit' as const;
