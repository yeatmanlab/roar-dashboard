import { z } from 'zod';

// TODO: For repeated enums like this, create a test file which validates that all instances are equal
// SEE: apps/backend/src/enums/user-type.enum.test.ts
export enum TASK_VARIANT_STATUS {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  DEPRECATED = 'deprecated',
}

/**
 * {name: paramName, value: paramValue}
 */
const TaskVariantParameter = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  // TODO: https://github.com/fastify/secure-json-parse (size, max depth, max array length, reserved keywords)
  // Use .superRefine();
  value: z.unknown(), // JSONB - can be any JSON-serializable value (string, number, boolean, object, array, null)
});

/**
 * [{name: paramName1, value: paramValue1}, {name: paramName2, value: paramValue2}...]
 */
const TaskVariantParametersArray = z.array(TaskVariantParameter).min(1);

export const TaskVariantCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(255),
  parameters: TaskVariantParametersArray,
  description: z.string().trim().min(1).max(1024),
  status: z.nativeEnum(TASK_VARIANT_STATUS),
});

export const TaskVariantCreateResponseSchema = z.object({
  id: z.string().uuid(),
});

export type TaskVariantParameter = z.infer<typeof TaskVariantParameter>;
export type TaskVariantParametersArray = z.infer<typeof TaskVariantParametersArray>;
export type TaskVariantCreateRequest = z.infer<typeof TaskVariantCreateRequestSchema>;
export type TaskVariantCreateResponse = z.infer<typeof TaskVariantCreateResponseSchema>;
