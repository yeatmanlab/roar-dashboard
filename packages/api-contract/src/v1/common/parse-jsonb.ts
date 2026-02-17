import { z } from 'zod';
import sjson from 'secure-json-parse';

// Validation constants
const MAX_STRING_BYTES = 1024;
const MAX_DEPTH = 5;
const MAX_ARRAY_LENGTH = 100;
const MAX_KEY_LENGTH = 50;
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

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
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValue), z.record(JsonValue)]),
);

/**
 * Validates JSONB values with comprehensive security and data quality checks.
 *
 * This function performs the following validations:
 * - Size limit: Maximum 4KB to prevent DoS attacks
 * - Type restriction: Only strings, numbers, booleans, and null (no undefined)
 * - Nesting depth: Maximum 5 levels to prevent stack overflow
 * - Array length: Maximum 100 items per array
 * - Object keys: Maximum 50 keys per object
 * - Dangerous keys: Blocks __proto__, constructor, prototype (prototype pollution protection)
 * - Number ranges: Must be finite and within safe integer range
 * - JSON validity: Must be parseable by secure-json-parse
 *
 * @param value - The JSON value to validate
 * @param ctx - Zod refinement context for adding validation issues
 *
 * @example
 * const schema = z.object({
 *   data: JsonValue.superRefine(parseJsonB)
 * });
 */
export function parseJsonB(value: Json, ctx: z.RefinementCtx) {
  const json = JSON.stringify(value);

  // Check if JSON is empty
  if (!json) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JSON value is empty',
    });
  }

  // Check total byte size (1 KB max)
  const stringBytes = Buffer.from(json).length;
  if (stringBytes > MAX_STRING_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `JSON value is too large (max ${MAX_STRING_BYTES} bytes)`,
    });
  }

  // Enforce only strings, numbers, booleans, and null (no undefined)
  const isValidType = (obj: unknown): boolean => {
    const type = typeof obj;

    if (type === 'string' || type === 'number' || type === 'boolean' || obj === null) {
      return true;
    }

    if (obj === undefined) {
      return false;
    }

    if (Array.isArray(obj)) {
      return obj.every(isValidType);
    }

    if (type === 'object') {
      return Object.values(obj).every(isValidType);
    }

    return false;
  };

  if (!isValidType(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JSON value must contain only strings, numbers, booleans, and null',
    });
  }

  // Check nesting depth (max 5 levels)
  const getDepth = (obj: unknown, depth = 0): number => {
    if (depth > MAX_DEPTH) return depth;
    if (obj && typeof obj === 'object') {
      const values = Array.isArray(obj) ? obj : Object.values(obj);
      if (values.length === 0) return depth;
      return 1 + Math.max(...values.map((v) => getDepth(v, depth + 1)));
    }
    return depth;
  };

  if (getDepth(value) > MAX_DEPTH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `JSON nesting depth exceeds maximum of ${MAX_DEPTH}`,
    });
  }

  // Check array lengths (max 100 items per array)
  const checkArrays = (obj: unknown): boolean => {
    if (Array.isArray(obj)) {
      if (obj.length > MAX_ARRAY_LENGTH) return false;
      return obj.every(checkArrays);
    }
    if (obj && typeof obj === 'object') {
      return Object.values(obj).every(checkArrays);
    }
    return true;
  };

  if (!checkArrays(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `JSON array exceeds maximum length of ${MAX_ARRAY_LENGTH}`,
    });
  }

  // Check object key counts and dangerous keys (max 50 keys per object)
  const checkObjects = (obj: unknown): boolean => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const keys = Object.keys(obj);

      if (keys.length > MAX_KEY_LENGTH) {
        return false;
      }

      // Check for dangerous keys (prototype pollution protection)
      for (const key of keys) {
        if (DANGEROUS_KEYS.includes(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Dangerous object key detected: ${key}`,
          });
          return false;
        }
      }

      // Recursively check nested objects
      return Object.values(obj).every(checkObjects);
    }
    if (Array.isArray(obj)) {
      return obj.every(checkObjects);
    }
    return true;
  };

  if (!checkObjects(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `JSON object has too many keys (max ${MAX_KEY_LENGTH})`,
    });
  }

  // Check number ranges (must be safe and finite)
  const checkNumberRanges = (obj: unknown): boolean => {
    if (typeof obj === 'number') {
      if (!Number.isFinite(obj)) return false;
      if (obj < Number.MIN_SAFE_INTEGER || obj > Number.MAX_SAFE_INTEGER) {
        return false;
      }
    }
    if (obj && typeof obj === 'object') {
      const values = Array.isArray(obj) ? obj : Object.values(obj);
      return values.every(checkNumberRanges);
    }
    return true;
  };

  if (!checkNumberRanges(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JSON contains number outside safe range or non-finite number',
    });
  }

  // Validate with secure JSON parse
  try {
    sjson.parse(json);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JSON value is invalid',
    });
  }
}
