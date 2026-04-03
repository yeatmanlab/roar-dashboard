/**
 * Common regex patterns used across API schemas
 */

/**
 * Matches valid BCP-47 locale codes.
 * ISO 639-1 two-letter language code with optional ISO 3166-1 two-letter region code.
 * Examples: "en", "en-US", "es", "es-MX"
 */
export const BCP47_LOCALE = /^[a-z]{2}(-[A-Z]{2})?$/;

/**
 * Matches valid identifiers that:
 * - Start with a letter (a-z, A-Z)
 * - Followed by letters, digits, underscores, hyphens, or spaces
 *
 * Examples: "My Task", "task-1", "Task_Variant", "a1 b2 c3", "my-task name"
 */
export const IDENTIFIER_WITH_SPACES = /^[a-zA-Z][a-zA-Z0-9_\- ]*$/;

/**
 * Matches valid identifier names that:
 * - Start with a letter (a-z, A-Z)
 * - Followed by letters, digits, underscores, or hyphens
 *
 * Examples: "myTask", "task-1", "Task_Variant", "a1b2c3"
 */
export const IDENTIFIER_WITH_HYPHENS = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * Matches valid identifiers that:
 * - Start with a letter (a-z, A-Z)
 * - Followed by letters, digits, or underscores only (no hyphens)
 *
 * Examples: "difficulty", "timeLimit", "max_attempts", "level1"
 */
export const IDENTIFIER_WITH_UNDERSCORES = /^[a-zA-Z][a-zA-Z0-9_]*$/;
