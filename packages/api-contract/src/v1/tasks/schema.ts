import { z } from 'zod';

const TaskVariantParameter = z.object({
  name: z.string().min(1).max(255),
  value: z.string().min(1).max(1024),
});

const TaskVariantParametersArray = z.array(TaskVariantParameter).min(1);

export const TaskVariantCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(255),
  parameters: TaskVariantParametersArray,
  description: z.string().trim().min(1).max(1024).optional(),
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
