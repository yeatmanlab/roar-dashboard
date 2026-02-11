import { z } from 'zod';

// TODO: Find ways to re-use status enum across project
export enum TASK_VARIANT_STATUS {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  DEPRECATED = 'deprecated',
}

const TaskVariantParameter = z.object({
  name: z.string().min(1).max(255),
  value: z.unknown(), // JSONB - can be any JSON-serializable value (string, number, boolean, object, array, null)
});

const TaskVariantParametersArray = z.array(TaskVariantParameter).min(1);

export const TaskVariantCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  parameters: TaskVariantParametersArray,
  description: z.string().trim().min(1).max(1024).optional(),
  status: z.nativeEnum(TASK_VARIANT_STATUS).default(TASK_VARIANT_STATUS.DRAFT),
});

export const TaskVariantCreateResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.literal('created'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type TaskVariantParameter = z.infer<typeof TaskVariantParameter>;
export type TaskVariantParametersArray = z.infer<typeof TaskVariantParametersArray>;
export type TaskVariantCreateRequest = z.infer<typeof TaskVariantCreateRequestSchema>;
export type TaskVariantCreateResponse = z.infer<typeof TaskVariantCreateResponseSchema>;
