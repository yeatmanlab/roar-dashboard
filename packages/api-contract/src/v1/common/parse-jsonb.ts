import { z } from 'zod';

// Validation constants
const MAX_STRING_BYTES = 1024;
const MAX_DEPTH = 5;
const MAX_ARRAY_LENGTH = 100;
const MAX_KEYS_PER_OBJECT = 50;
const MAX_KEY_NAME_LENGTH = 50;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * JSON-compatible value type for JSONB columns and payloads.
 *
 * Supports:
 * - string: Text values, IDs, enums
 * - number: Numeric values, counts, limits
 * - boolean: True/false flags
 * - null: Optional/unset parameters (see usage below)
 * - Arrays and objects containing the above types
 *
 * ## Null Usage
 *
 * Use `null` to represent optional parameters that:
 * - Are not applicable to this task variant (e.g., audioSupport for a text-only task)
 * - Have not been configured yet (e.g., experimentalCondition not assigned)
 * - Should use system defaults (e.g., timeLimit = null means no time restriction)
 *
 * @example
 * // Optional parameter not applicable
 * { "name": "audioSupport", "value": null }
 *
 * @example
 * // Mix of set and unset parameters
 * {
 *   "name": "config",
 *   "value": {
 *     "difficulty": "hard",
 *     "timeLimit": 60,
 *     "shuffleItems": true,
 *     "hints": null,  // Not providing hints for this variant
 *     "customInstructions": null  // Use default instructions
 *   }
 * }
 *
 * @example
 * // Research scenario with unset values
 * {
 *   "name": "experimentalSettings",
 *   "value": {
 *     "condition": "control",
 *     "intervention": null,  // Control group - no intervention
 *     "followupScore": null  // Not measured yet
 *   }
 * }
 */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Zod schema for validating JSON values.
 *
 * Accepts strings, numbers, booleans, null, arrays, and objects.
 * Recursive validation ensures nested structures are also valid.
 */
export const JsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValue), z.object({}).catchall(JsonValue)]),
);

/**
 * Validates JSONB values with comprehensive security and data quality checks.
 *
 * This function performs the following validations in a single pass:
 * - Size limit: Maximum 1 KB to prevent DoS attacks
 * - Type restriction: Only strings, numbers, booleans, and null (no undefined)
 * - Nesting depth: Maximum 5 levels to prevent stack overflow
 * - Array length: Maximum 100 items per array
 * - Object keys: Maximum 50 keys per object, max 50 chars per key name
 * - Dangerous keys: Blocks __proto__, constructor, prototype (prototype pollution protection)
 * - Number ranges: Must be finite and within safe integer range
 *
 * Notes on depth:
 * - The root value is validated at depth = 1
 * - Each nested array/object increases depth by 1
 * - Depth must be <= MAX_DEPTH
 *
 * @param value - The JSON value to validate
 * @param ctx - Zod refinement context for adding validation issues
 *
 * @example
 * const schema = z.object({
 *   data: JsonValue.superRefine(parseJsonB)
 * });
 */
export function parseJsonB(value: Json, ctx: z.RefinementCtx): void {
  // Check total byte size (1 KB max)
  const json = JSON.stringify(value);
  const byteLength = Buffer.byteLength(json, 'utf8');

  if (byteLength > MAX_STRING_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `JSON value exceeds maximum size of ${MAX_STRING_BYTES} bytes`,
    });
    return; // Early return - no point validating structure if too large
  }

  // Single-pass recursive validation.
  // Returns true/false for short-circuiting; emits at most one issue (the first encountered).
  const validate = (obj: unknown, depth: number): boolean => {
    // Check depth (root is depth=1)
    if (depth > MAX_DEPTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `JSON nesting depth exceeds maximum of ${MAX_DEPTH}`,
      });
      return false;
    }

    // Primitives
    if (obj === null || typeof obj === 'string' || typeof obj === 'boolean') {
      return true;
    }

    // Numbers - check range
    if (typeof obj === 'number') {
      if (!Number.isFinite(obj) || obj < Number.MIN_SAFE_INTEGER || obj > Number.MAX_SAFE_INTEGER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JSON contains number outside safe range or non-finite number',
        });
        return false;
      }
      return true;
    }

    // Reject undefined explicitly (defense-in-depth; JsonValue schema already excludes it)
    if (obj === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JSON value must not contain undefined',
      });
      return false;
    }

    // Arrays
    if (Array.isArray(obj)) {
      if (obj.length > MAX_ARRAY_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `JSON array exceeds maximum length of ${MAX_ARRAY_LENGTH}`,
        });
        return false;
      }
      for (const item of obj) {
        if (!validate(item, depth + 1)) return false;
      }
      return true;
    }

    // Objects
    if (typeof obj === 'object') {
      const record = obj as Record<string, unknown>;
      const keys = Object.keys(record);

      if (keys.length > MAX_KEYS_PER_OBJECT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `JSON object exceeds maximum of ${MAX_KEYS_PER_OBJECT} keys`,
        });
        return false;
      }

      for (const key of keys) {
        if (key.length > MAX_KEY_NAME_LENGTH) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `JSON object key is too long (max ${MAX_KEY_NAME_LENGTH} chars)`,
          });
          return false;
        }

        if (DANGEROUS_KEYS.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Dangerous object key detected: ${key}`,
          });
          return false;
        }
      }

      // Validate values (single pass, short-circuit on first failure)
      for (const val of Object.values(record)) {
        if (!validate(val, depth + 1)) return false;
      }

      return true;
    }

    // Unknown type (symbol, bigint, function, etc.) - defense-in-depth
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid JSON value type: ${typeof obj}`,
    });
    return false;
  };

  // Root counts as depth 1
  validate(value, 1);
}
